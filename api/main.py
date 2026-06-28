from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from google import genai
from crawl4ai import AsyncWebCrawler
import json
from urllib.parse import urlparse
import socket
import ipaddress
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def sanitize_log(text: str) -> str:
    if text is None:
        return "None"
    return str(text).replace('\n', '\\n').replace('\r', '\\r')

app = FastAPI()

class VerifyRequest(BaseModel):
    text: str
    source_url: Optional[str] = None

class VerifyResponse(BaseModel):
    is_threat: bool
    reframe: str

@app.post("/verify", response_model=VerifyResponse)
async def verify_content(request: VerifyRequest):
    context_markdown = ""

    if request.source_url:
        parsed_url = urlparse(request.source_url)
        if parsed_url.scheme not in ["http", "https"]:
            raise HTTPException(status_code=400, detail="Invalid URL scheme. Only HTTP and HTTPS are allowed.")

        if not parsed_url.hostname:
            raise HTTPException(status_code=400, detail="Invalid URL: Missing hostname.")

        try:
            # Resolve the hostname to an IP address
            ip_str = socket.gethostbyname(parsed_url.hostname)
            ip_obj = ipaddress.ip_address(ip_str)

            # Block private, loopback, and link-local (e.g., AWS metadata 169.254.169.254) networks
            # Note: DNS rebinding attacks (TOCTOU) are still theoretically possible unless DNS resolution
            # is pinned inside the AsyncWebCrawler, but this blocks the most common SSRF attempts.
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                raise HTTPException(status_code=400, detail="Internal or forbidden hostnames are not allowed.")
        except socket.gaierror:
            raise HTTPException(status_code=400, detail="Could not resolve hostname.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid IP address format.")

        try:
            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(url=request.source_url)
                # The result contains markdown string of the scraped page
                context_markdown = result.markdown
        except Exception as e:
            logger.error(f"Error crawling URL {sanitize_log(request.source_url)}: {e}")
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
        logger.error(f"JSON Parsing Error: {e} | Response text was: {sanitize_log(response.text)}")
        raise HTTPException(status_code=500, detail="Failed to parse LLM response")
    except Exception as e:
        logger.error(f"GenAI Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during verification")
