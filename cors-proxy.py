#!/usr/bin/env python3
"""
Incruit Jobpost Editor — Unified Web Server
정적 파일 서빙 + CORS 프록시 + EUC-KR 인코딩을 하나의 서버로 통합

Usage:
  python3 cors-proxy.py [port]
  Default port: 8787

Endpoints:
  GET  /health          → 서버 상태 확인
  GET  /proxy?url=...   → CORS 프록시 (GET)
  POST /proxy?url=...   → CORS 프록시 (POST)
  POST /encode          → UTF-8 → EUC-KR 인코딩
  *    /*                → 정적 파일 서빙 (index.html, css/, js/ 등)
"""

import sys
import os
import re
import json
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.parse import urlparse, parse_qs, unquote
from urllib.error import URLError, HTTPError
import ssl

# SSL 인증서 검증 비활성화 (프록시 요청 전용)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

# 정적 파일 루트 (이 스크립트가 위치한 디렉토리)
STATIC_ROOT = os.path.dirname(os.path.abspath(__file__))

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age': '86400',
}

# 허용 도메인 (보안)
ALLOWED_DOMAINS = [
    'job.incruit.com', 'm.incruit.com', 'www.incruit.com',
    'api.anthropic.com', 'api.openai.com',
    'generativelanguage.googleapis.com',
    'api.figma.com',
    'team.greeting.com', 'career.rememberapp.co.kr',
    'www.rocketpunch.com', 'www.jumpit.co.kr', 'www.wanted.co.kr',
    'jobs.lever.co', 'boards.greenhouse.io',
    'job.alio.go.kr', 'www.work24.go.kr',
    'api-builder.recruiter.co.kr',
    'ai-studio.incru.it',
]

# MIME 타입 보강
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/wasm', '.wasm')


class UnifiedHandler(BaseHTTPRequestHandler):

    def _set_cors_headers(self):
        for key, val in CORS_HEADERS.items():
            self.send_header(key, val)

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        # API 엔드포인트
        if path == '/health':
            self._handle_health()
            return
        if path.startswith('/proxy'):
            self._proxy_request('GET')
            return

        # 정적 파일 서빙
        self._serve_static(path)

    def do_POST(self):
        path = urlparse(self.path).path

        if path == '/encode':
            self._handle_encode()
            return
        if path.startswith('/proxy'):
            self._proxy_request('POST')
            return

        self.send_response(404)
        self.end_headers()

    # --- 정적 파일 서빙 ---

    def _serve_static(self, path):
        # URL 경로 → 파일시스템 경로
        if path == '/' or path == '':
            path = '/index.html'

        # 보안: 상위 디렉토리 접근 차단
        rel_path = path.lstrip('/')
        file_path = os.path.normpath(os.path.join(STATIC_ROOT, rel_path))
        if not file_path.startswith(STATIC_ROOT):
            self.send_response(403)
            self.end_headers()
            return

        # 디렉토리 → index.html
        if os.path.isdir(file_path):
            file_path = os.path.join(file_path, 'index.html')

        if not os.path.isfile(file_path):
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.end_headers()
            self.wfile.write(f'404 Not Found: {path}'.encode('utf-8'))
            return

        # MIME 타입 결정
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = 'application/octet-stream'

        # 텍스트 파일은 UTF-8 charset 추가
        if content_type.startswith('text/') or content_type in ('application/javascript', 'application/json'):
            content_type += '; charset=utf-8'

        try:
            with open(file_path, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(data)
        except IOError:
            self.send_response(500)
            self.end_headers()

    # --- Health ---

    def _handle_health(self):
        self.send_response(200)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'ok'}).encode())

    # --- EUC-KR 인코딩 ---

    def _handle_encode(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            text = body.decode('utf-8')
            encoded = text.encode('cp949', errors='xmlcharrefreplace')
            self.send_response(200)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
        except Exception as e:
            self.send_response(500)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    # --- CORS 프록시 ---

    def _proxy_request(self, method):
        parsed = urlparse(self.path)
        if not parsed.path.startswith('/proxy'):
            self.send_response(404)
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(b'Use /proxy?url=<target_url>')
            return

        qs = parse_qs(parsed.query)
        target_url = qs.get('url', [None])[0]

        if not target_url:
            self.send_response(400)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'url parameter required'}).encode())
            return

        target_url = unquote(target_url)
        target_domain = urlparse(target_url).hostname

        try:
            # 요청 헤더 포워딩 (hop-by-hop 제외)
            headers = {}
            skip_headers = {'host', 'connection', 'accept-encoding', 'transfer-encoding',
                            'anthropic-dangerous-direct-browser-access', 'origin', 'referer'}
            for key, val in self.headers.items():
                if key.lower() not in skip_headers:
                    headers[key] = val

            # User-Agent 기본값
            if 'User-Agent' not in headers:
                headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

            # 바디 읽기 (POST)
            body = None
            if method == 'POST':
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)

            req = Request(target_url, data=body, headers=headers, method=method)
            resp = urlopen(req, context=ssl_ctx, timeout=60)

            resp_body = resp.read()

            # --- EUC-KR → UTF-8 자동 변환 ---
            content_type = resp.getheader('Content-Type') or ''
            is_html = 'text/html' in content_type or 'text/plain' in content_type

            if is_html:
                # 1) HTTP 헤더에서 charset 감지
                charset = None
                ct_match = re.search(r'charset=([\w\-]+)', content_type, re.I)
                if ct_match:
                    charset = ct_match.group(1).lower().replace('_', '-')

                # 2) HTML meta 태그에서 charset 감지 (바이트 레벨 검색)
                if not charset:
                    meta_match = re.search(rb'charset=([\w\-]+)', resp_body[:2048], re.I)
                    if meta_match:
                        charset = meta_match.group(1).decode('ascii', errors='ignore').lower().replace('_', '-')

                # 3) EUC-KR 계열이면 UTF-8로 변환
                if charset in ('euc-kr', 'euckr', 'ks-c-5601-1987', 'ks-c5601-1987', 'ksc5601', 'cp949', 'ms949'):
                    try:
                        decoded = resp_body.decode('euc-kr', errors='replace')
                        decoded = re.sub(
                            r'(<meta[^>]*charset=)([\w\-]+)',
                            r'\1utf-8',
                            decoded,
                            flags=re.I
                        )
                        resp_body = decoded.encode('utf-8')
                        content_type = re.sub(r'charset=[\w\-]+', 'charset=utf-8', content_type, flags=re.I)
                        if 'charset' not in content_type.lower():
                            content_type += '; charset=utf-8'
                    except Exception as e:
                        print(f"[Server] EUC-KR 변환 실패: {e}")

            # 응답 전송
            self.send_response(resp.status)
            self._set_cors_headers()

            for key, val in resp.getheaders():
                lower = key.lower()
                if lower in ('transfer-encoding', 'connection', 'access-control-allow-origin'):
                    continue
                if lower == 'content-type':
                    self.send_header(key, content_type)
                elif lower == 'content-length':
                    self.send_header(key, str(len(resp_body)))
                else:
                    self.send_header(key, val)

            self.end_headers()
            self.wfile.write(resp_body)

        except HTTPError as e:
            self.send_response(e.code)
            self._set_cors_headers()
            error_body = e.read()
            error_ct = e.headers.get('Content-Type', 'application/json') if hasattr(e, 'headers') else 'application/json'
            self.send_header('Content-Type', error_ct)
            self.send_header('Content-Length', str(len(error_body)))
            self.end_headers()
            self.wfile.write(error_body)

        except (URLError, TimeoutError) as e:
            self.send_response(502)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def log_message(self, format, *args):
        method = args[0] if args else ''
        status = args[1] if len(args) > 1 else ''
        # 정적 파일 요청은 조용하게, 프록시/API는 로그
        req_path = method.split(' ')[1] if ' ' in str(method) else str(method)
        if '/proxy' in req_path or '/health' in req_path or '/encode' in req_path:
            print(f"[Server] {method} → {status}")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    server = HTTPServer(('0.0.0.0', port), UnifiedHandler)
    print(f"=== Incruit Jobpost Editor Server ===")
    print(f"http://localhost:{port}")
    print(f"Static files: {STATIC_ROOT}")
    print(f"Proxy:  /proxy?url=<target_url>")
    print(f"Health: /health")
    print(f"Encode: /encode")
    print(f"Press Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping...")
        server.server_close()


if __name__ == '__main__':
    main()
