import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from api.main import app

client = TestClient(app)

@patch('api.main.genai.Client')
def test_verify_json_decode_error(mock_genai_client):
    # Setup mock to return invalid JSON
    mock_client_instance = MagicMock()
    mock_genai_client.return_value = mock_client_instance

    mock_response = MagicMock()
    # The string must be invalid JSON that will cause json.loads to raise json.JSONDecodeError
    mock_response.text = '```json\n{"is_threat": true, "reframe": "valid until here... oops\n```'

    mock_models = MagicMock()
    mock_models.generate_content.return_value = mock_response
    mock_client_instance.models = mock_models

    # Make request
    response = client.post("/verify", json={"text": "Test text"})

    # Assertions
    assert response.status_code == 500
    assert response.json() == {"detail": "Failed to parse LLM response"}

@patch('api.main.AsyncWebCrawler')
@patch('api.main.genai.Client')
def test_verify_ssrf_protection_blocked(mock_genai_client, mock_crawler_class):
    # Setup mock GenAI client to return a valid response
    mock_client_instance = MagicMock()
    mock_genai_client.return_value = mock_client_instance
    mock_response = MagicMock()
    mock_response.text = '{"is_threat": false, "reframe": "Safe content"}'
    mock_models = MagicMock()
    mock_models.generate_content.return_value = mock_response
    mock_client_instance.models = mock_models

    # Test cases that should be blocked
    unsafe_urls = [
        "file:///etc/passwd",
        "http://localhost:8000/admin",
        "http://127.0.0.1/server-status",
        "http://169.254.169.254/latest/meta-data/"
    ]

    for url in unsafe_urls:
        mock_crawler_instance = MagicMock()
        mock_crawler_class.return_value.__aenter__.return_value = mock_crawler_instance

        response = client.post("/verify", json={"text": "Test text", "source_url": url})

        assert response.status_code == 200
        # Assert crawler was not called
        mock_crawler_instance.arun.assert_not_called()

@patch('api.main.AsyncWebCrawler')
@patch('api.main.genai.Client')
def test_verify_ssrf_protection_allowed(mock_genai_client, mock_crawler_class, monkeypatch):
    # Setup mock GenAI client
    mock_client_instance = MagicMock()
    mock_genai_client.return_value = mock_client_instance
    mock_response = MagicMock()
    mock_response.text = '{"is_threat": false, "reframe": "Safe content"}'
    mock_models = MagicMock()
    mock_models.generate_content.return_value = mock_response
    mock_client_instance.models = mock_models

    # Mock AsyncWebCrawler
    mock_crawler_instance = MagicMock()
    mock_crawler_class.return_value.__aenter__.return_value = mock_crawler_instance
    mock_crawl_result = MagicMock()
    mock_crawl_result.markdown = "Scraped markdown content"

    # Setup async mock for arun
    import asyncio
    future = asyncio.Future()
    future.set_result(mock_crawl_result)
    mock_crawler_instance.arun.return_value = future

    # Test cases that should be allowed
    safe_urls = [
        "http://example.com/page",
        "https://google.com/search"
    ]

    # Mock loop.getaddrinfo to return a public IP for these domains
    # Mock the loop's getaddrinfo indirectly by mocking socket.getaddrinfo
    import socket
    original_getaddrinfo = socket.getaddrinfo

    def mock_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if host in ("example.com", "google.com"):
            return [(socket.AF_INET, socket.SOCK_STREAM, socket.IPPROTO_TCP, '', ('8.8.8.8', port))]
        return original_getaddrinfo(host, port, family, type, proto, flags)

    monkeypatch.setattr(socket, "getaddrinfo", mock_getaddrinfo)

    for url in safe_urls:
        mock_crawler_instance.arun.reset_mock()

        response = client.post("/verify", json={"text": "Test text", "source_url": url})

        assert response.status_code == 200
        # Assert crawler was called
        mock_crawler_instance.arun.assert_called_once_with(url=url)
