import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from api.main import app
import pytest

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

@patch('api.main.genai.Client')
@patch('socket.getaddrinfo')
def test_verify_ssrf_protection_loopback(mock_getaddrinfo, mock_genai_client):
    # Mock DNS to return a loopback IP
    mock_getaddrinfo.return_value = [(2, 1, 6, '', ('127.0.0.1', 0))]

    mock_client_instance = MagicMock()
    mock_genai_client.return_value = mock_client_instance

    mock_response = MagicMock()
    mock_response.text = '{"is_threat": false, "reframe": "Safe text."}'

    mock_models = MagicMock()
    mock_models.generate_content.return_value = mock_response
    mock_client_instance.models = mock_models

    # Request with internal URL
    response = client.post("/verify", json={"text": "Test text", "source_url": "http://localhost:8000/internal"})

    assert response.status_code == 200

    # If the SSRF check works, the crawler won't run, but the endpoint still succeeds
    # Let's ensure that we actually hit the endpoint and get the expected response
    assert response.json() == {"is_threat": False, "reframe": "Safe text."}

    # We can also verify that the mocked model was called without the context_markdown
    # since the crawl should have been skipped
    prompt_used = mock_models.generate_content.call_args[1]['contents']
    assert "Cross-reference data (Scraped Markdown Context from source):" not in prompt_used

@patch('api.main.genai.Client')
@patch('socket.getaddrinfo')
def test_verify_ssrf_protection_invalid_scheme(mock_getaddrinfo, mock_genai_client):
    mock_client_instance = MagicMock()
    mock_genai_client.return_value = mock_client_instance

    mock_response = MagicMock()
    mock_response.text = '{"is_threat": false, "reframe": "Safe text."}'

    mock_models = MagicMock()
    mock_models.generate_content.return_value = mock_response
    mock_client_instance.models = mock_models

    # Request with invalid scheme (file://)
    response = client.post("/verify", json={"text": "Test text", "source_url": "file:///etc/passwd"})

    assert response.status_code == 200
    assert response.json() == {"is_threat": False, "reframe": "Safe text."}

    # Assert crawler wasn't used
    prompt_used = mock_models.generate_content.call_args[1]['contents']
    assert "Cross-reference data" not in prompt_used
