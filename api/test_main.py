import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from api.main import app
import socket

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

@patch('socket.getaddrinfo')
def test_verify_ssrf_protection_rejects_localhost(mock_getaddrinfo):
    # Mock getaddrinfo to return 127.0.0.1
    mock_getaddrinfo.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 80))]

    response = client.post("/verify", json={
        "text": "Check this",
        "source_url": "http://localhost:8000/admin"
    })

    assert response.status_code == 400
    assert "Unsafe IP address detected" in response.json()["detail"]

@patch('socket.getaddrinfo')
def test_verify_ssrf_protection_rejects_aws_metadata(mock_getaddrinfo):
    # Mock getaddrinfo to return 169.254.169.254
    mock_getaddrinfo.return_value = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('169.254.169.254', 80))]

    response = client.post("/verify", json={
        "text": "Check this",
        "source_url": "http://169.254.169.254/latest/meta-data/"
    })

    assert response.status_code == 400
    assert "Unsafe IP address detected" in response.json()["detail"]
