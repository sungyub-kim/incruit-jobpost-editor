# Incruit Jobpost Editor - 개발환경 설정 가이드

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [시스템 요구사항](#시스템-요구사항)
- [개발환경 설정](#개발환경-설정)
  - [Windows 환경](#windows-환경)
  - [macOS 환경](#macos-환경)
- [프로젝트 실행](#프로젝트-실행)
- [개발 워크플로우](#개발-워크플로우)
- [트러블슈팅](#트러블슈팅)

---

## 🎯 프로젝트 개요

Incruit Jobpost Editor는 채용공고를 AI를 활용하여 Incruit 템플릿 형식으로 변환하는 웹 애플리케이션입니다.

### 주요 기능
- 📄 다양한 문서 형식 지원 (DOCX, PDF, HWP, HWPX, XLSX 등)
- 🤖 AI 기반 자동 변환 (OpenAI, Claude, Gemini)
- 🎨 키 비주얼(KV) 이미지 생성 및 편집
- 📝 실시간 미리보기 및 인라인 편집

### 기술 스택
- **프론트엔드**: Vanilla JavaScript, Tailwind CSS
- **백엔드**: Python (Flask)
- **배포**: 
  - 현재: AWS EC2 (Ubuntu 22.04 LTS), Nginx, GitHub Actions
  - 향후: IDC (Rocky Linux 9), Nginx, GitLab CI/CD

---

## 💻 시스템 요구사항

### 공통 요구사항
- **Git**: 2.x 이상
- **Python**: 3.8 이상 (권장: 3.9+)
- **웹 브라우저**: Chrome, Firefox, Edge 최신 버전

### Windows 추가 요구사항
- Windows 10 이상
- PowerShell 5.1 이상 또는 WSL2 (선택)

### macOS 추가 요구사항
- macOS 10.15 (Catalina) 이상
- Xcode Command Line Tools

---

## 🛠 개발환경 설정

### Windows 환경

#### 1. Python 설치

**방법 A: Microsoft Store에서 설치 (권장)**
```powershell
# Microsoft Store에서 "Python 3.12" 검색 후 설치
```

**방법 B: 공식 웹사이트에서 설치**
1. https://www.python.org/downloads/ 접속
2. "Download Python 3.x" 클릭
3. 설치 시 **"Add Python to PATH"** 체크 필수

**설치 확인**
```powershell
python --version
# 출력: Python 3.12.x
```

#### 2. hosts 파일 설정

**CloudFront 도메인을 로컬에서 테스트하기 위한 설정**

```powershell
# 관리자 권한으로 메모장 실행
# Windows 키 → "notepad" 검색 → 우클릭 → "관리자 권한으로 실행"

# 다음 파일 열기
C:\Windows\System32\drivers\etc\hosts

# 파일 끝에 다음 줄 추가
13.225.117.88  ai-studio.incru.it

# 저장 후 닫기
```

#### 3. 저장소 클론

```powershell
# 프로젝트 디렉토리로 이동
cd C:\Projects

# 저장소 클론
git clone https://github.com/incruit-git/incruit-jobpost-editor.git
cd incruit-jobpost-editor
```

#### 3. Python 가상환경 설정

```powershell
# 가상환경 생성
python -m venv venv

# 가상환경 활성화
.\venv\Scripts\Activate.ps1

# 권한 오류 발생 시
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### 4. 의존성 설치

```powershell
# pip 업그레이드
python -m pip install --upgrade pip

# 프로젝트 의존성 설치
pip install -r requirements.txt

# 설치 확인
pip list
```

#### 5. LibreOffice 설치 (HWP 변환용, 선택)

1. https://www.libreoffice.org/download 접속
2. Windows 버전 다운로드 및 설치
3. 기본 경로: `C:\Program Files\LibreOffice\program\soffice.exe`

---

### macOS 환경

#### 1. Homebrew 설치 (없는 경우)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 2. Python 설치

```bash
# Homebrew로 Python 설치
brew install python@3.12

# 설치 확인
python3 --version
# 출력: Python 3.12.x
```

#### 3. hosts 파일 설정

**CloudFront 도메인을 로컬에서 테스트하기 위한 설정**

```bash
# hosts 파일 편집 (관리자 권한 필요)
sudo nano /etc/hosts

# 파일 끝에 다음 줄 추가
13.225.117.88  ai-studio.incru.it

# 저장: Ctrl + O, Enter
# 종료: Ctrl + X

# DNS 캐시 플러시
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

#### 4. 저장소 클론

```bash
# 프로젝트 디렉토리로 이동
cd ~/Projects

# 저장소 클론
git clone https://github.com/incruit-git/incruit-jobpost-editor.git
cd incruit-jobpost-editor
```

#### 5. Python 가상환경 설정

```bash
# 가상환경 생성
python3 -m venv venv

# 가상환경 활성화
source venv/bin/activate

# 프롬프트가 (venv)로 시작하면 성공
```

#### 5. 의존성 설치

```bash
# pip 업그레이드
pip install --upgrade pip

# 프로젝트 의존성 설치
pip install -r requirements.txt

# 설치 확인
pip list
```

#### 6. LibreOffice 설치 (HWP 변환용, 선택)

```bash
# Homebrew로 설치
brew install --cask libreoffice

# 설치 경로 확인
which soffice
# 출력: /Applications/LibreOffice.app/Contents/MacOS/soffice
```

---

## 🚀 프로젝트 실행

### 1. 백엔드 서버 실행

프로젝트는 두 개의 Python 서버가 필요합니다:
- **CORS Proxy Server** (포트 8787): Anthropic API 호출용
- **Document Converter Server** (포트 8082): 문서 변환용

#### Windows (PowerShell)

**터미널 1 - CORS Proxy Server**
```powershell
cd C:\Projects\incruit-jobpost-editor
.\venv\Scripts\Activate.ps1
python cors-proxy.py
```

**터미널 2 - Document Converter Server**
```powershell
cd C:\Projects\incruit-jobpost-editor
.\venv\Scripts\Activate.ps1
python convert-server.py
```

#### macOS (Terminal)

**터미널 1 - CORS Proxy Server**
```bash
cd ~/Projects/incruit-jobpost-editor
source venv/bin/activate
python3 cors-proxy.py
```

**터미널 2 - Document Converter Server**
```bash
cd ~/Projects/incruit-jobpost-editor
source venv/bin/activate
python3 convert-server.py
```

### 2. 프론트엔드 실행

백엔드 서버가 실행된 상태에서 `index.html` 파일을 브라우저로 엽니다.

#### 방법 A: Live Server 사용 (권장)

**VSCode에서**
1. Live Server 확장 설치
2. `index.html` 우클릭
3. "Open with Live Server" 선택

#### 방법 B: 직접 열기

```
file:///C:/Projects/incruit-jobpost-editor/index.html  (Windows)
file:///Users/username/Projects/incruit-jobpost-editor/index.html  (macOS)
```

### 3. 서버 상태 확인

브라우저에서 다음 URL로 접속하여 서버 정상 동작 확인:

```
http://localhost:8787/health  → {"status": "ok"}
http://localhost:8082/health  → {"status": "ok", "formats": [...]}
```

---

## 📝 개발 워크플로우

### 브랜치 전략

```bash
# 새 기능 개발
git checkout -b feature/기능명

# 개발 완료 후
git add .
git commit -m "feat: 기능 설명"
git push origin feature/기능명

# GitHub에서 Pull Request 생성
```

### 코드 수정 후 테스트

1. **프론트엔드 수정** (HTML, CSS, JS)
   - Live Server 사용 시 자동 새로고침
   - 브라우저에서 수동 새로고침 (F5)

2. **백엔드 수정** (Python)
   - 서버 재시작 필요
   - `Ctrl + C`로 서버 종료 후 재실행

### 환경 변수 설정

API 키는 브라우저의 LocalStorage에 저장됩니다:

1. 애플리케이션 실행
2. 우측 상단 ⚙️ 아이콘 클릭
3. "AI 설정" 탭에서 API 키 입력

---

## 🔧 트러블슈팅

### Windows 관련 문제

#### PowerShell 실행 정책 오류
```powershell
# 오류: 이 시스템에서 스크립트를 실행할 수 없으므로...
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Python 명령어 인식 안 됨
```powershell
# PATH 환경변수에 Python 추가
# 제어판 → 시스템 → 고급 시스템 설정 → 환경 변수
# Path에 추가: C:\Users\Username\AppData\Local\Programs\Python\Python312
```

#### 포트 이미 사용 중
```powershell
# 8787 포트 사용 중인 프로세스 찾기
netstat -ano | findstr :8787

# 프로세스 종료 (PID 확인 후)
taskkill /PID <프로세스ID> /F
```

### macOS 관련 문제

#### Python3 명령어 없음
```bash
# Homebrew Python 링크
brew link python@3.12

# 또는 alias 설정
echo "alias python=python3" >> ~/.zshrc
source ~/.zshrc
```

#### 포트 이미 사용 중
```bash
# 8787 포트 사용 중인 프로세스 찾기
lsof -i :8787

# 프로세스 종료 (PID 확인 후)
kill -9 <PID>
```

#### LibreOffice 경로 인식 안 됨
```bash
# convert-server.py가 자동으로 탐지하지만, 수동 확인 필요 시
ls /Applications/LibreOffice.app/Contents/MacOS/soffice
```

### 공통 문제

#### CORS 에러 발생
- CORS Proxy 서버(8787) 실행 여부 확인
- http://localhost:8787/health 접속하여 응답 확인

#### 문서 변환 실패
- Document Converter 서버(8082) 실행 여부 확인
- HWP 변환 시 LibreOffice 설치 여부 확인

#### AI 변환 실패
- API 키 설정 확인 (브라우저 LocalStorage)
- CORS Proxy 서버 실행 확인 (Claude 사용 시)

---

## 📚 추가 리소스

- **프로젝트 문서**: `/docs` 디렉토리 참조
- **API 스키마**: `/docs/schema/incruit-jobpost.schema.json`
- **운영 배포 구조**: `DEPLOYMENT.md` 참조

---

## 🤝 도움이 필요하신가요?

문제가 해결되지 않으면:
1. GitHub Issues에 문제 등록
2. 팀 Slack 채널에 문의
3. 기술 리드에게 직접 연락

---

**Last Updated**: 2026-02-15
