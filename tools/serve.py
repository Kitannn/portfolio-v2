# Static dev server for this site.
#
# Same as `python -m http.server` except it sends Cache-Control: no-store. The stylesheet and
# app.js carry ?v= cache busters, but the arcade page's ES modules import each other by plain
# path, and a plain reload will happily serve those from the browser's cache — which looks
# exactly like "my edit did nothing".
#
#   python tools/serve.py [port]        default 8768
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8768


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        # keep the console to errors; a game page requests a lot of files
        if not args or not str(args[0]).startswith(("GET", "HEAD")) or " 200 " not in " ".join(str(a) for a in args):
            super().log_message(fmt, *args)


print(f"serving {ROOT} at http://localhost:{PORT} (no-store)")
ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
