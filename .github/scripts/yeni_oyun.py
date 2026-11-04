#!/usr/bin/env python3
"""GitHub Issue formunu doğrular ve BİLKOD oyun listesine güvenle yeni oyun ekler."""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[2]
GAMES_FILE = ROOT / "oyunlar.json"
CATEGORIES = {
    "Kodlama", "Algoritma", "Dikkat ve Hafıza", "Sanat ve Tasarım",
    "Yapboz", "Tasarım ve İnşa", "Diğer",
}


def field(body, label):
    pattern = r"(?ms)^### " + re.escape(label) + r"\s*\n(.*?)(?=^### |\Z)"
    match = re.search(pattern, body)
    if match is None:
        return ""
    value = match.group(1).strip()
    return "" if value == "_No response_" else value


def single_line(value, name, max_length):
    value = " ".join(value.split())
    if not value or len(value) > max_length:
        raise ValueError(f"{name} boş olamaz ve en fazla {max_length} karakter olabilir.")
    return value


def game_url(value):
    value = single_line(value, "Oyun bağlantısı", 250)
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https"
        or parsed.netloc.lower() != "bilfen-bilkod.github.io"
        or not re.fullmatch(r"/[a-zA-Z0-9._-]+/?", parsed.path)
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Oyun bağlantısı bilfen-bilkod.github.io/oyun-adi/ biçiminde olmalıdır.")
    return urlunsplit(("https", "bilfen-bilkod.github.io", parsed.path.rstrip("/") + "/", "", ""))


def cover_url(value):
    value = value.strip() or "assets/covers/yeni-oyun.svg"
    if re.fullmatch(r"assets/covers/[a-z0-9-]+\.svg", value):
        if not (ROOT / value).is_file():
            raise ValueError("Seçilen kapak dosyası depoda mevcut değil.")
        return value
    parsed = urlsplit(value)
    if parsed.scheme == "https" and parsed.netloc and not parsed.username and not parsed.password and len(value) <= 500:
        return value
    raise ValueError("Kapak HTTPS adresi veya mevcut assets/covers/*.svg dosyası olmalıdır.")


def main():
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if not event_path:
        raise ValueError("GITHUB_EVENT_PATH ortam değişkeni eksik.")
    event = json.loads(Path(event_path).read_text(encoding="utf-8"))
    issue = event["issue"]
    if issue["user"]["login"].casefold() != "bilfen-bilkod":
        raise PermissionError("Yalnızca bilfen-bilkod GitHub hesabı oyun yayınlayabilir.")
    if not issue["title"].startswith("[BİLKOD OYUN]"):
        raise ValueError("Bu kayıt bir BİLKOD oyun yayınlama isteği değil.")

    body = issue.get("body") or ""
    title = single_line(field(body, "Oyun adı"), "Oyun adı", 90)
    url = game_url(field(body, "Oyun bağlantısı"))
    category = single_line(field(body, "Kategori"), "Kategori", 40)
    if category not in CATEGORIES:
        raise ValueError("Kategori listede bulunmuyor.")

    ages_raw = field(body, "Yaş grupları")
    ages = [single_line(v, "Yaş grubu", 35) for v in ages_raw.split(",") if v.strip()]
    if len(ages) > 5:
        raise ValueError("En fazla 5 yaş grubu belirtilebilir.")

    description = " ".join(field(body, "Açıklama").split())
    if len(description) > 180:
        raise ValueError("Açıklama en fazla 180 karakter olabilir.")

    cover = cover_url(field(body, "Kapak görseli"))
    repo_name = urlsplit(url).path.strip("/")
    game_id = re.sub(r"[^a-z0-9]+", "-", repo_name.casefold()).strip("-")
    if not game_id:
        raise ValueError("Oyun kimliği oluşturulamadı.")

    payload = json.loads(GAMES_FILE.read_text(encoding="utf-8"))
    games = payload.get("games")
    if not isinstance(games, list):
        raise ValueError("oyunlar.json biçimi geçersiz.")
    for old in games:
        if old.get("id") == game_id or (old.get("url") or "").rstrip("/").casefold() == url.rstrip("/").casefold():
            raise ValueError("Bu oyun zaten oyun kütüphanesinde kayıtlı.")

    games.append({
        "id": game_id,
        "title": title,
        "description": description,
        "category": category,
        "ageGroups": ages,
        "url": url,
        "cover": cover,
        "addedAt": datetime.now(timezone.utc).date().isoformat(),
        "isNew": True,
        "published": True,
    })
    GAMES_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Yeni oyun eklendi: {title} ({url}); toplam {len(games)} oyun.")


if __name__ == "__main__":
    main()
