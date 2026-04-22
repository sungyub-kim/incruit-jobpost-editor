# 배포 방법 가이드

> **저장소**: incruit-jobpost-editor  
> **배포 대상**: AWS EC2 (`ai-studio.incru.it`) / Cloudflare Pages (`incruit-jobpost-editor`)

---

## 📋 배포 워크플로우 파일

| 파일 | 배포 대상 | 트리거 |
|------|----------|--------|
| `.github/workflows/deploy-aws.yml` | AWS EC2 | 수동 |
| `.github/workflows/deploy-cloudflare.yml` | Cloudflare Pages | 수동 |

> ⚠️ `git push`만으로는 자동 배포되지 않습니다. 아래 방법 중 하나로 직접 실행해야 합니다.

---

## 방법 1. GitHub 웹에서 배포 (설치 불필요 ✅ 디자이너 권장)

1. https://github.com/incruit-git/incruit-jobpost-editor 접속
2. 상단 **Actions** 탭 클릭
3. 왼쪽 목록에서 배포할 워크플로우 선택
   - `Deploy to AWS EC2` → AWS 서버 배포
   - `Deploy to Cloudflare Pages` → Cloudflare 배포
4. 우측 **"Run workflow"** 드롭다운 클릭
5. **"Run workflow"** 초록 버튼 클릭

---

## 방법 2. 터미널 명령어로 배포 (개발자용)

### gh CLI 설치 (최초 1회)

**Windows (Git Bash)**
```bash
winget install --id GitHub.cli
# 터미널 재시작 후
gh --version
```

**macOS**
```bash
brew install gh
```

### GitHub 로그인 (최초 1회)

```bash
gh auth login
# → GitHub.com 선택
# → HTTPS 선택
# → Login with a web browser 선택
# → 표시된 코드 복사 후 브라우저에서 인증
```

### 배포 명령어

```bash
# AWS EC2 배포
gh workflow run deploy-aws.yml

# Cloudflare Pages 배포
gh workflow run deploy-cloudflare.yml
```

### 배포 상태 확인

```bash
gh run list --limit 5     # 최근 실행 목록
gh run watch              # 실시간 진행 확인
```

---

## 방법 3. antigravity 터미널에서 배포

antigravity 터미널에서 아래 명령어 입력:

```bash
# AWS EC2 배포
gh workflow run deploy-aws.yml

# Cloudflare Pages 배포
gh workflow run deploy-cloudflare.yml
```

> gh가 설치되어 있지 않다면 **방법 1 (GitHub 웹)** 사용

---

## 코드 푸시 vs 배포 구분

```bash
# 코드만 올리기 (배포 안 됨)
git push origin main

# AWS에 배포
gh workflow run deploy-aws.yml

# Cloudflare에 배포
gh workflow run deploy-cloudflare.yml
```

---

## 필요한 GitHub Secrets

| Secret | 용도 |
|--------|------|
| `AWS_ACCESS_KEY_ID` | AWS 인증 |
| `AWS_SECRET_ACCESS_KEY` | AWS 인증 |
| `AWS_REGION` | AWS 리전 |
| `AWS_SECURITY_GROUP_ID` | EC2 보안그룹 |
| `EC2_HOST` | EC2 서버 주소 |
| `EC2_USER` | EC2 SSH 사용자 |
| `EC2_SSH_KEY` | EC2 SSH 키 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare 인증 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |

> Secrets 등록: GitHub 저장소 → Settings → Secrets and variables → Actions
