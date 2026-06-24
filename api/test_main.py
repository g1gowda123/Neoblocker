import pytest
import socket
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
from api.main import app

client = TestClient(app)

@patch('socket.getaddrinfo')
def test_verify_ssrf_safe_url(mock_getaddrinfo):
    # Mock DNS resolution to return a public IP
    mock_getaddrinfo.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 80))]

    with patch('api.main.AsyncWebCrawler.arun', new_callable=AsyncMock) as mock_crawl:
        mock_crawl.return_value.markdown = "Safe content"

        with patch('api.main.genai.Client') as mock_genai_client:
            mock_client_instance = MagicMock()
            mock_genai_client.return_value = mock_client_instance

            mock_response = MagicMock()
            mock_response.text = '{"is_threat": false, "reframe": "Safe content summary"}'

            mock_models = MagicMock()
            mock_models.generate_content.return_value = mock_response
            mock_client_instance.models = mock_models

            response = client.post("/verify", json={"text": "Test text", "source_url": "http://example.com"})

            assert response.status_code == 200
            assert response.json()["is_threat"] is False

@pytest.mark.parametrize("unsafe_url", [
    "http://localhost",
    "http://127.0.0.1",
    "http://192.168.1.1",
    "http://10.0.0.1",
    "file:///etc/passwd",
    "ftp://example.com",
    "http://169.254.169.254",
    "http://0.0.0.0",
])
@patch('socket.getaddrinfo')
def test_verify_ssrf_unsafe_url(mock_getaddrinfo, unsafe_url):
    # For IPs like 127.0.0.1, getaddrinfo typically resolves them directly
    # We mock it to match standard socket.getaddrinfo output for these IPs
    def mock_dns_resolve(host, port, *args, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (host, port))]

    mock_getaddrinfo.side_effect = mock_dns_resolve

    response = client.post("/verify", json={"text": "Test text", "source_url": unsafe_url})

    assert response.status_code == 400
    assert response.json() == {"detail": "Invalid or unsafe source_url provided"}

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
