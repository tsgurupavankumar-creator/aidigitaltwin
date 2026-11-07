import io
import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from pypdf import PdfReader, PdfWriter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from syllabus_parser import MAX_PDF, SyllabusParseError, extract_text, parse_syllabus, validate_syllabus

FIXTURE = Path(__file__).parent / 'fixtures' / 'sample-syllabus.pdf'
VALID = {'modules': [{'name': 'Module 1', 'orderIndex': 0,
                      'topics': [{'name': 'Algorithms', 'orderIndex': 0}]}]}


def mock_client(content):
    client = MagicMock()
    client.chat.completions.create.return_value.choices = [MagicMock(message=MagicMock(content=content))]
    return client


def test_sample_pdf_has_text():
    text = extract_text(FIXTURE.read_bytes())
    assert 'Module' in text
    assert len(text) > 100


def test_valid_pdf_returns_contract_shape():
    result = parse_syllabus(
        FIXTURE.read_bytes(),
        client=mock_client(json.dumps(VALID))
    )

    assert len(result["modules"]) == 1
    module = result["modules"][0]
    assert module["name"] == VALID["modules"][0]["name"]
    assert module["orderIndex"] == 0
    assert len(module["topics"]) == 1

    topic = module["topics"][0]
    assert topic["name"] == "Algorithms"
    assert topic["orderIndex"] == 0
    assert topic["depth"] == 0
    assert topic["parentTopicIndex"] is None
    assert topic["prerequisiteIndexes"] == []
    assert topic["levelTarget"] in (
        "BEGINNER", "INTERMEDIATE", "ADVANCED"
    )
    assert topic["estimatedMinutes"] > 0
    assert result["warnings"]
    assert 0 <= result["overallConfidence"] <= 1


def test_oversize_rejected_before_pdf_open(monkeypatch):
    import pdfplumber
    monkeypatch.setattr(pdfplumber, 'open', lambda *_: pytest.fail('Should not open'))
    with pytest.raises(SyllabusParseError, match='10 MB'):
        extract_text(b'%PDF-' + b'a' * MAX_PDF)


def test_encrypted_pdf_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.encrypt('protected')
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(SyllabusParseError, match='Encrypted'):
        extract_text(output.getvalue())


def test_empty_pdf_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(SyllabusParseError, match='no extractable text'):
        extract_text(output.getvalue())


def test_invalid_llm_schema_rejected():
    with pytest.raises(SyllabusParseError):
        parse_syllabus(FIXTURE.read_bytes(), client=mock_client('{"modules":[{"name":"Hallucinated"}]}'))


def test_mcq_fixture_structure():
    fixture = json.loads((Path(__file__).resolve().parents[1] / 'fixtures' / 'quiz_stub.json').read_text())
    assert len(fixture['questions']) == 10
    assert [q['type'] for q in fixture['questions']].count('mcq') == 6
    assert all(q['correctAnswer'] in q['options'] for q in fixture['questions'] if q['type'] == 'mcq')
