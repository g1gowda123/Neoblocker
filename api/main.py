from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from google import genai
from crawl4ai import AsyncWebCrawler, BrowserConfig
import json
from urllib.parse import urlparse
import asyncio
import socket
import ipaddress
import logging
import re
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
    text: str = Field(..., max_length=5000)
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

        # Mitigate Argument Injection for Chromium crawler
        # Note: urlparse strips brackets from IPv6 hostnames, so we check the raw hex/colons
        if not re.match(r"^([a-zA-Z0-9.-]+|[a-fA-F0-9:]+)$", parsed_url.hostname):
            raise HTTPException(status_code=400, detail="Invalid URL: Hostname contains invalid characters.")

        try:
            # Resolve the hostname to an IP address
            loop = asyncio.get_running_loop()
            addr_info = await loop.getaddrinfo(parsed_url.hostname, None)

            # Store the first valid IP to prevent DNS rebinding attacks
            safe_ip = None

            for item in addr_info:
                ip_str = item[4][0]
                ip_obj = ipaddress.ip_address(ip_str)

                # Block private, loopback, link-local, multicast, and unspecified networks
                # Also explicitly require the IP to be globally routable (blocks reserved ranges)
                if (ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or
                    ip_obj.is_multicast or ip_obj.is_unspecified or not ip_obj.is_global):
                    raise HTTPException(status_code=400, detail="Internal or forbidden hostnames are not allowed.")

                if not safe_ip:
                    safe_ip = ip_str

        except socket.gaierror:
            raise HTTPException(status_code=400, detail="Could not resolve hostname.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid IP address format.")

        try:
            # Pin DNS resolution for this hostname to the validated safe_ip to prevent
            # DNS rebinding attacks (TOCTOU) without breaking SNI on HTTPS connections.
            # Using chromium's host resolver rules via BrowserConfig.
            browser_config = BrowserConfig(
                extra_args=[f"--host-resolver-rules=MAP {parsed_url.hostname} {safe_ip}"]
            )
            async with AsyncWebCrawler(config=browser_config) as crawler:
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
