# Incruit Jobpost Editor - 운영 배포 구조 

## 📋 목차

- [전체 아키텍처](#전체-아키텍처)
- [배포 환경](#배포-환경)
- [배포 프로세스](#배포-프로세스)
- [네트워크 구조](#네트워크-구조)
- [보안 구성](#보안-구성)
- [모니터링](#모니터링)
- [장애 대응](#장애-대응)

---

## 🏗 전체 아키텍처

### 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────────┐
│                           사용자 (브라우저)                           │
│                    https://ai-studio.incru.it                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTPS (443)
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        AWS CloudFront (CDN)                          │
│  - 정적 콘텐츠 캐싱                                                   │
│  - SSL/TLS 종료                                                      │
│  - DDoS 방어 (AWS Shield)                                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP (80)
                             ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      AWS EC2 (Ubuntu 22.04 LTS)                      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Nginx (Reverse Proxy)                     │   │
│  │  - 포트: 80                                                  │   │
│  │  - Gzip 압축                                                 │   │
│  │  - 정적 파일 서빙                                             │   │
│  │  - 보안 헤더 추가                                             │   │
│  └──────────────────────┬──────────────────────────────────────┘   │
│                         │                                            │
│                         │ File System                                │
│                         ↓                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │          /var/www/incruit-jobpost-editor/                    │   │
│  │  ├── index.html                                              │   │
│  │  ├── css/                                                    │   │
│  │  ├── js/                                                     │   │
│  │  └── assets/                                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 외부 API 통신 구조

```
┌──────────────────┐
│  사용자 브라우저   │
└────────┬─────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         │ Anthropic API 호출                   │ OpenAI/Gemini API 호출
         │ (CORS 제약)                          │ (직접 호출)
         ↓                                     ↓
┌──────────────────┐                  ┌──────────────────┐
│  CORS Proxy      │                  │  외부 AI API      │
│  (로컬 개발용)    │                  │  - OpenAI        │
│  localhost:8787  │                  │  - Gemini        │
└──────────────────┘                  └──────────────────┘
         │
         │ API 포워딩
         ↓
┌──────────────────┐
│  Anthropic API   │
│  (Claude)        │
└──────────────────┘
```

---

## 🌍 배포 환경

### AWS 인프라

| 구성 요소 | 사양 | 용도 |
|---------|------|------|
| **EC2 인스턴스** | t3.small | 웹 서버 (Nginx) |
| **운영체제** | Ubuntu 22.04 LTS | 안정적인 LTS 배포판 |
| **리전** | ap-northeast-2 (서울) | 저지연 서비스 제공 |
| **CloudFront** | Global Edge | CDN 캐싱 및 SSL |
| **Route 53** | DNS | 도메인 관리 |

### 도메인 구조

```
incru.it (루트 도메인)
  └── *.incru.it (와일드카드 SSL)
       └── ai-studio.incru.it → CloudFront → EC2
```

**CloudFront IP**: `13.225.117.88`

**로컬 테스트용 hosts 파일 설정** (DNS 등록 전):
```
# Windows: C:\Windows\System32\drivers\etc\hosts
# macOS/Linux: /etc/hosts

13.225.117.88  ai-studio.incru.it
```

---

## 🚀 배포 프로세스

### GitHub Actions CI/CD 파이프라인

```
개발자 PC
   │
   │ git push origin main
   ↓
┌─────────────────────────────────────────────────────┐
│          GitHub Repository (main branch)             │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Webhook Trigger
                 ↓
┌─────────────────────────────────────────────────────┐
│           GitHub Actions Workflow                    │
│                                                       │
│  1. ✅ 코드 체크아웃                                   │
│  2. 📦 배포 파일 준비                                  │
│     - index.html, css/, js/, assets/                 │
│  3. 🔐 AWS 자격 증명 설정                              │
│  4. 🌐 GitHub Actions IP 획득                         │
│  5. 🔓 Security Group에 임시 IP 추가                   │
│  6. 🔑 SSH 키 설정                                    │
│  7. 📤 Nginx 설정 파일 배포                            │
│  8. 📤 정적 파일 rsync 배포                            │
│  9. 🔄 Nginx 재시작                                   │
│  10. ✅ 배포 검증                                      │
│  11. 🔒 Security Group에서 IP 제거                     │
└────────────────┬────────────────────────────────────┘
                 │
                 │ SSH (포트 22)
                 ↓
┌─────────────────────────────────────────────────────┐
│              AWS EC2 (운영 서버)                      │
│                                                       │
│  /var/www/incruit-jobpost-editor/                   │
│  /etc/nginx/sites-available/incruit-jobpost-editor  │
└─────────────────────────────────────────────────────┘
```

### 배포 단계별 상세

#### 1단계: 코드 준비
```yaml
- Checkout code
- Prepare deployment files
  ├── index.html
  ├── css/
  ├── js/
  └── assets/
```

#### 2단계: 보안 설정
```yaml
- Configure AWS credentials
- Get GitHub Actions IP
- Add IP to Security Group (임시)
```

#### 3단계: 파일 배포
```yaml
- Deploy Nginx configuration
  └── /etc/nginx/sites-available/incruit-jobpost-editor

- Deploy static files (rsync)
  └── /var/www/incruit-jobpost-editor/
```

#### 4단계: 서비스 재시작
```yaml
- Reload Nginx
- Verify Nginx status
- Test HTTP response
```

#### 5단계: 정리
```yaml
- Remove IP from Security Group
- Deployment summary
```

---

## 🔒 보안 구성

### Security Group 규칙

#### 인바운드 규칙

| 프로토콜 | 포트 | 소스 | 용도 |
|---------|------|------|------|
| TCP | 80 | 0.0.0.0/0 | HTTP (CloudFront) |
| TCP | 22 | GitHub Actions IP (동적) | SSH 배포 |

#### 아웃바운드 규칙

| 프로토콜 | 포트 | 대상 | 용도 |
|---------|------|------|------|
| All | All | 0.0.0.0/0 | 외부 통신 허용 |

### Nginx 보안 헤더

```nginx
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### SSL/TLS 인증서

- **발급 기관**: Let's Encrypt (또는 기존 *.incru.it 와일드카드)
- **프로토콜**: TLS 1.2, 1.3
- **종료 지점**: CloudFront
- **EC2**: HTTP 80 (CloudFront와 내부 통신)

---

## 📊 모니터링

### Nginx 로그

```bash
# 액세스 로그
tail -f /var/log/nginx/incruit-editor-access.log

# 에러 로그
tail -f /var/log/nginx/incruit-editor-error.log
```

### 시스템 모니터링

```bash
# CPU/메모리 사용률
htop

# 디스크 사용량
df -h

# Nginx 상태
systemctl status nginx

# 네트워크 연결
ss -tunlp | grep nginx
```

### CloudWatch 메트릭 (예정)

- CPU 사용률
- 네트워크 트래픽
- 디스크 I/O
- HTTP 응답 시간

---

## 🚨 장애 대응

### 일반적인 문제 해결

#### Nginx가 시작되지 않음

```bash
# 설정 파일 문법 검사
sudo nginx -t

# 에러 로그 확인
sudo tail -50 /var/log/nginx/error.log

# Nginx 재시작
sudo systemctl restart nginx
```

#### 배포 실패 (GitHub Actions)

1. **GitHub Actions 로그 확인**
   - Repository → Actions → 실패한 워크플로우 클릭
   
2. **Security Group 확인**
   - EC2 콘솔 → Security Groups
   - 포트 22 인바운드 규칙 확인

3. **SSH 키 검증**
   - GitHub Secrets에서 `EC2_SSH_KEY` 확인
   - 로컬에서 SSH 접속 테스트

#### 사이트 접속 불가

```bash
# 1. EC2 인스턴스 상태 확인
aws ec2 describe-instance-status --instance-ids i-xxxxxxxxx

# 2. Nginx 프로세스 확인
ps aux | grep nginx

# 3. 포트 80 리스닝 확인
netstat -tlnp | grep :80

# 4. CloudFront 캐시 무효화
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### 롤백 절차

```bash
# EC2에 SSH 접속
ssh user@ai-studio.incru.it

# 이전 버전으로 복구
sudo cp /etc/nginx/sites-available/incruit-jobpost-editor.backup.YYYYMMDD_HHMMSS \
       /etc/nginx/sites-available/incruit-jobpost-editor

# Nginx 재시작
sudo systemctl reload nginx
```

---

## 🔄 향후 계획: IDC 전환

### 현재 (AWS)
```
GitHub → GitHub Actions → AWS EC2 (Ubuntu 22.04 LTS)
```

### 전환 후 (IDC)
```
GitLab → GitLab CI/CD → IDC 서버 (Rocky Linux 9)
```

### 전환 시 변경 사항

| 항목 | AWS | IDC |
|------|-----|-----|
| 운영체제 | Ubuntu 22.04 LTS | Rocky Linux 9 |
| CI/CD | GitHub Actions | GitLab CI/CD |
| 네트워크 | Public Cloud | Private Network |
| SSL | CloudFront | 자체 인증서 |
| 모니터링 | CloudWatch | Prometheus/Grafana |

---

## 📞 연락처

**운영 담당**
- 이메일: ops@incruit.com
- Slack: #incruit-jobpost-editor

**긴급 연락**
- 24/7 On-call: +82-10-XXXX-XXXX

---

**Last Updated**: 2026-02-15
