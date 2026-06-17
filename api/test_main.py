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
