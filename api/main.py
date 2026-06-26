from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from google import genai
from crawl4ai import AsyncWebCrawler
import json
from dotenv import load_dotenv
import asyncio
import ipaddress
from urllib.parse import urlparse
import socket

load_dotenv()

app = FastAPI()

class VerifyRequest(BaseModel):
    text: str
    source_url: Optional[str] = None

class VerifyResponse(BaseModel):
    is_threat: bool
    reframe: str

async def validate_url(url: str) -> str:
    parsed = urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: missing hostname")

    loop = asyncio.get_running_loop()
    # non-blocking resolution
    addr_infos = await loop.getaddrinfo(hostname, None)

    safe = False
    for info in addr_infos:
        ip_str = info[4][0]
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_unspecified:
            raise ValueError(f"Unsafe IP address detected: {ip_str}")
        safe = True

    if not safe:
        raise ValueError("Could not resolve safe IP address")

    return url

@app.post("/verify", response_model=VerifyResponse)
async def verify_content(request: VerifyRequest):
    context_markdown = ""

    if request.source_url:
        try:
            valid_url = await validate_url(request.source_url)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid URL")

        try:
            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(url=valid_url)
                # The result contains markdown string of the scraped page
                context_markdown = result.markdown
        except Exception as e:
            print(f"Error crawling URL {request.source_url}: {e}")
            # Proceed without context or fail. We proceed for resilience.

    try:
        # Initialize GenAI client
        # Requires GOOGLE_API_KEY environment variable
        client = genai.Client()

        prompt = f"""
        You are an expert Agent Jury for a Cognitive Defense Firewall.
        Your task is to analyze a piece of text to detect hallucinations, misinformation, or manipulative social engineering.

        Original Text to evaluate:
        "{request.text}"
        """

        if context_markdown:
            prompt += f"""

            Cross-reference data (Scraped Markdown Context from source):
            {context_markdown}
            """

        prompt += """

        Determine if the original text is a threat (misinformation, manipulation, hallucination).
        Provide a neutral summary (reframe) of the content based on the facts available.

        Return EXACTLY a JSON object with this structure, with no additional text or formatting:
        {
            "is_threat": true or false,
            "reframe": "Neutral summary of the content"
        }
        """

        # Use gemini-3.1-pro as requested
        response = client.models.generate_content(
            model='gemini-3.1-pro',
            contents=prompt,
        )

        # Clean up response to parse JSON in case model includes markdown formatting
        text_response = response.text.strip()
        if text_response.startswith('```json'):
            text_response = text_response[7:-3]
        elif text_response.startswith('```'):
            text_response = text_response[3:-3]

        data = json.loads(text_response.strip())

        return VerifyResponse(
            is_threat=data.get("is_threat", False),
            reframe=data.get("reframe", "Failed to reframe.")
        )

    except json.JSONDecodeError as e:
        print(f"JSON Parsing Error: {e}\nResponse text was: {response.text}")
        raise HTTPException(status_code=500, detail="Failed to parse LLM response")
    except Exception as e:
        print(f"GenAI Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during verification")
