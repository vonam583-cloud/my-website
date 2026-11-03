"""Serve the Kể Nè demonstration locally with Python's standard library."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import threading
import webbrowser


def main():
    parser = argparse.ArgumentParser(description="Chạy website Kể Nè trên localhost")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error("Chọn cổng từ 1024 đến 65535.")
    directory = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        print(f"Không mở được cổng {args.port}: {error}")
        print("Thử: python start_kene.py --port 8080")
        return 1
    url = f"http://localhost:{args.port}/"
    print(f"Kể Nè đang chạy tại {url}")
    print("Chỉ dùng dữ liệu thử nghiệm. Nhấn Ctrl+C để dừng.")
    if not args.no_browser:
        timer = threading.Timer(0.5, lambda: webbrowser.open(url))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng Kể Nè.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
