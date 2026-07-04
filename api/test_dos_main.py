import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_verify_dos_input_limit():
    large_text = "a" * 5001
    response = client.post("/verify", json={"text": large_text})
    assert response.status_code == 422
    assert "String should have at most 5000 characters" in response.json()["detail"][0]["msg"]

def test_verify_valid_input_limit():
    valid_text = "a" * 5000
    # To mock the client so we don't need actual GenAI
    from unittest.mock import patch, MagicMock
    with patch('api.main.genai.Client') as mock_genai_client:
        mock_client_instance = MagicMock()
        mock_genai_client.return_value = mock_client_instance

        mock_response = MagicMock()
        mock_response.text = '{"is_threat": false, "reframe": "test"}'

        mock_models = MagicMock()
        mock_models.generate_content.return_value = mock_response
        mock_client_instance.models = mock_models

        response = client.post("/verify", json={"text": valid_text})
        assert response.status_code == 200
