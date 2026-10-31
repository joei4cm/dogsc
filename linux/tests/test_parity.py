from dogsc.parity import CHOICES, matrix


def test_recommended_is_qt6():
    payload = matrix()
    assert payload["recommended"] == "qt6-qml-vulkan"
    assert payload["active"] == "web-soft-silver"
    assert payload["bridge"]["next"] == "qt6-qml-vulkan"


def test_choices_cover_apple_contract():
    payload = matrix()
    assert "chrome" in payload["apple"]
    assert "motion" in payload["apple"]
    assert "preview" in payload["apple"]
    assert "capture" in payload["apple"]
    ids = {choice.id for choice in CHOICES}
    assert ids >= {"qt6-qml-vulkan", "tauri-wgpu", "web-soft-silver", "gtk4-gstreamer"}
    assert CHOICES[0].score >= CHOICES[-1].score


def test_environment_exposes_parity():
    from dogsc.platform import detect

    env = detect().as_dict()
    assert env["parity"]["recommended"] == "qt6-qml-vulkan"
