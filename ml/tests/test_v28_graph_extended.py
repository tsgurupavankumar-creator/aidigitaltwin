from syllabus_parser import enrich_syllabus_tree


def make_topics(names):
    return {
        "modules": [{
            "name": "Unit I",
            "orderIndex": 0,
            "topics": [
                {"name": name, "orderIndex": i}
                for i, name in enumerate(names)
            ]
        }]
    }


def test_numbered_hierarchy():
    data = make_topics([
        "1 Introduction",
        "1.1 Basic Concepts",
        "1.1.1 Advanced Concepts",
        "1.2 Applications",
        "2 Second Unit",
        "2.1 Another Topic"
    ])

    topics = enrich_syllabus_tree(data)["modules"][0]["topics"]

    assert [t["depth"] for t in topics] == [0, 1, 2, 1, 0, 1]
    assert topics[2]["parentTopicIndex"] == 1
    assert topics[3]["parentTopicIndex"] == 0
    assert topics[5]["parentTopicIndex"] == 4


def test_flat_syllabus_stays_flat():
    data = make_topics([
        "Introduction to AI",
        "Search Algorithms",
        "Knowledge Representation"
    ])

    topics = enrich_syllabus_tree(data)["modules"][0]["topics"]

    assert all(t["depth"] == 0 for t in topics)
    assert all(not t["prerequisiteIndexes"] for t in topics)


def test_explicit_prerequisite():
    data = make_topics([
        "1 Introduction to AI",
        "2 Search Algorithms",
        "3 Advanced Planning"
    ])

    data["modules"][0]["topics"][2]["description"] = (
        "Prerequisite: Search Algorithms"
    )

    topics = enrich_syllabus_tree(data)["modules"][0]["topics"]

    assert topics[2]["prerequisiteIndexes"] == [1]


def test_missing_parent_does_not_link_unrelated_topic():
    data = make_topics([
        "1 Introduction",
        "2.1 Orphan Topic"
    ])

    topics = enrich_syllabus_tree(data)["modules"][0]["topics"]

    assert topics[1]["depth"] == 0
    assert topics[1]["parentTopicIndex"] is None


def test_prerequisite_from_original_pdf_text():
    data = make_topics([
        "1 Introduction to Search",
        "1.1 Breadth-First Search",
        "1.2 Informed Search",
        "1.2.1 A Star Search"
    ])

    pdf_text = """
Module 1: Search Techniques
1 Introduction to Search
1.1 Breadth-First Search
1.2 Informed Search
1.2.1 A Star Search
Prerequisite: Breadth-First Search
"""

    topics = enrich_syllabus_tree(
        data, source_text=pdf_text
    )["modules"][0]["topics"]

    assert topics[3]["prerequisiteIndexes"] == [1]
    assert topics[3]["depth"] == 2
