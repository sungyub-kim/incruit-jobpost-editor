# 시스템 아키텍처 도식

## 전체 시스템 구조

```mermaid
graph TB
    User[👤 사용자<br/>브라우저]
    
    subgraph "AWS Cloud"
        CF[☁️ CloudFront CDN<br/>SSL/TLS 종료<br/>정적 콘텐츠 캐싱]
        
        subgraph "EC2 Instance (Ubuntu 22.04 LTS)"
            Nginx[🌐 Nginx<br/>포트: 80<br/>Reverse Proxy]
            StaticFiles[📁 정적 파일<br/>/var/www/incruit-jobpost-editor<br/>index.html, css/, js/, assets/]
        end
    end
    
    subgraph "외부 API"
        Anthropic[🤖 Anthropic API<br/>Claude]
        OpenAI[🤖 OpenAI API<br/>GPT-4]
        Gemini[🤖 Google Gemini API]
    end
    
    LocalProxy[💻 CORS Proxy<br/>localhost:8787<br/>로컬 개발용]
    
    User -->|HTTPS 443| CF
    CF -->|HTTP 80| Nginx
    Nginx -->|File System| StaticFiles
    
    User -.->|개발 환경<br/>CORS 우회| LocalProxy
    LocalProxy -.->|API Forward| Anthropic
    
    User -->|직접 API 호출| OpenAI
    User -->|직접 API 호출| Gemini
    
    style User fill:#4A90E2,stroke:#2E5C8A,color:#fff
    style CF fill:#FF9900,stroke:#CC7A00,color:#fff
    style Nginx fill:#009639,stroke:#006627,color:#fff
    style StaticFiles fill:#E8F5E9,stroke:#4CAF50,color:#333
    style Anthropic fill:#F4E4D7,stroke:#D4A574,color:#333
    style OpenAI fill:#10A37F,stroke:#0E8C6F,color:#fff
    style Gemini fill:#4285F4,stroke:#3367D6,color:#fff
    style LocalProxy fill:#FFF9C4,stroke:#FBC02D,color:#333
```

## CI/CD 배포 파이프라인

```mermaid
graph LR
    A[👨‍💻 개발자<br/>git push] --> B[📦 GitHub<br/>Repository]
    B -->|Webhook| C{🔄 GitHub Actions<br/>Workflow}
    
    C --> D1[1️⃣ 코드 체크아웃]
    D1 --> D2[2️⃣ 배포 파일 준비<br/>index.html, css/, js/]
    D2 --> D3[3️⃣ AWS 인증]
    D3 --> D4[4️⃣ Security Group<br/>IP 추가]
    D4 --> D5[5️⃣ SSH 연결]
    D5 --> D6[6️⃣ Nginx 설정 배포]
    D6 --> D7[7️⃣ 정적 파일 rsync]
    D7 --> D8[8️⃣ Nginx 재시작]
    D8 --> D9[9️⃣ 배포 검증]
    D9 --> D10[🔟 IP 제거]
    
    D10 --> E[✅ 배포 완료<br/>https://ai-studio.incru.it]
    
    style A fill:#4A90E2,color:#fff
    style B fill:#24292E,color:#fff
    style C fill:#2088FF,color:#fff
    style E fill:#28A745,color:#fff
```

## 배포 전후 상태 변화

```mermaid
stateDiagram-v2
    [*] --> Developing: 로컬 개발
    Developing --> Testing: 기능 완성
    Testing --> Committing: 테스트 통과
    Committing --> Pushing: git commit
    Pushing --> CITriggered: git push origin main
    
    CITriggered --> Building: GitHub Actions 실행
    Building --> Deploying: 빌드 성공
    Deploying --> Verifying: 파일 전송 완료
    Verifying --> Production: 검증 성공
    
    Production --> [*]: 서비스 운영 중
    
    Verifying --> Rollback: 검증 실패
    Rollback --> Production: 이전 버전 복구
```

## 네트워크 보안 구조

```mermaid
graph TB
    Internet[🌍 인터넷]
    
    subgraph "AWS VPC"
        subgraph "Public Subnet"
            SG[🛡️ Security Group<br/>인바운드: 80, 22<br/>아웃바운드: All]
            EC2[🖥️ EC2 Instance<br/>Ubuntu 22.04 LTS]
        end
    end
    
    GHA[🔧 GitHub Actions<br/>동적 IP]
    
    Internet -->|HTTPS 443| CloudFront[☁️ CloudFront]
    CloudFront -->|HTTP 80| SG
    SG -->|Allow| EC2
    
    GHA -.->|SSH 22<br/>임시 허용| SG
    GHA -.->|배포 완료 후<br/>Rule 삭제| SG
    
    style Internet fill:#4A90E2,color:#fff
    style SG fill:#FF6B6B,stroke:#C92A2A,color:#fff
    style EC2 fill:#FF9900,stroke:#CC7A00,color:#fff
    style CloudFront fill:#232F3E,color:#fff
    style GHA fill:#2088FF,color:#fff
```

## 개발 vs 운영 환경 비교

```mermaid
graph LR
    subgraph "개발 환경"
        Dev[👨‍💻 개발자 PC]
        DevProxy[CORS Proxy<br/>:8787]
        DevConvert[Convert Server<br/>:8082]
        DevBrowser[브라우저<br/>file:/// or localhost]
        
        Dev --> DevProxy
        Dev --> DevConvert
        Dev --> DevBrowser
    end
    
    subgraph "운영 환경"
        Prod[👤 최종 사용자]
        ProdCF[CloudFront CDN]
        ProdEC2[EC2 + Nginx]
        
        Prod --> ProdCF
        ProdCF --> ProdEC2
    end
    
    DevBrowser -.->|배포| ProdEC2
    
    style Dev fill:#4A90E2,color:#fff
    style Prod fill:#28A745,color:#fff
    style DevProxy fill:#FFF9C4,color:#333
    style DevConvert fill:#FFF9C4,color:#333
    style ProdCF fill:#FF9900,color:#fff
    style ProdEC2 fill:#009639,color:#fff
```

## 데이터 흐름: 문서 변환 프로세스

```mermaid
sequenceDiagram
    participant U as 👤 사용자
    participant B as 🌐 브라우저
    participant C as 🔧 Convert Server<br/>(개발: :8082)
    participant AI as 🤖 AI API<br/>(OpenAI/Claude/Gemini)
    
    U->>B: 파일 업로드 (DOCX, PDF, HWP)
    B->>C: POST /api/convert
    Note over C: 파일 형식 감지<br/>LibreOffice 변환<br/>(HWP → DOCX)
    C-->>B: { html, text, metadata }
    
    B->>B: HTML 미리보기 렌더링
    U->>B: "AI 변환" 버튼 클릭
    
    B->>AI: API 요청<br/>(프롬프트 + 원본 텍스트)
    Note over AI: Incruit 템플릿 변환<br/>섹션별 구조화
    AI-->>B: 변환된 HTML
    
    B->>B: 미리보기 업데이트
    U->>B: 인라인 편집
    U->>B: "복사" 또는 "다운로드"
    B-->>U: 최종 결과물
```

## 장애 발생 시 복구 흐름

```mermaid
graph TD
    Start[🚨 장애 감지] --> Check{장애 유형?}
    
    Check -->|Nginx 오류| Nginx[Nginx 재시작]
    Check -->|파일 손상| Rollback[이전 버전 롤백]
    Check -->|네트워크 문제| Network[Security Group 확인]
    Check -->|디스크 부족| Disk[로그 정리/디스크 확장]
    
    Nginx --> Verify{정상 동작?}
    Rollback --> Verify
    Network --> Verify
    Disk --> Verify
    
    Verify -->|예| End[✅ 복구 완료]
    Verify -->|아니오| Escalate[🆘 긴급 대응 팀<br/>에스컬레이션]
    
    Escalate --> Manual[수동 복구 진행]
    Manual --> End
    
    style Start fill:#FF6B6B,color:#fff
    style End fill:#28A745,color:#fff
    style Escalate fill:#FF9900,color:#fff
```

---

## 파일 구조 맵

```
incruit-jobpost-editor/
│
├── 📄 index.html              # 메인 HTML
│
├── 📁 css/                    # 스타일시트
│   ├── main.css
│   └── tailwind.config.js
│
├── 📁 js/                     # JavaScript 모듈
│   ├── app.js                 # 메인 앱
│   ├── services/              # API 서비스
│   │   ├── aiService.js       # AI 호출
│   │   ├── fileExtractor.js   # 문서 변환
│   │   └── urlExtractor.js    # URL 파싱
│   └── utils/
│
├── 📁 assets/                 # 정적 리소스
│   ├── images/
│   └── fonts/
│
├── 📁 nginx/                  # Nginx 설정
│   └── incruit-jobpost-editor.conf
│
├── 📁 .github/                # CI/CD
│   └── workflows/
│       └── deploy.yml
│
├── 🐍 cors-proxy.py           # CORS 프록시 (개발용)
├── 🐍 convert-server.py       # 문서 변환 서버 (개발용)
├── 📋 requirements.txt        # Python 의존성
│
└── 📁 docs/                   # 프로젝트 문서
    ├── 01-plan/
    ├── 02-design/
    └── schema/
```

---

**참고**: 위 다이어그램은 [Mermaid](https://mermaid-js.github.io/)로 작성되었습니다. GitHub README에서 자동으로 렌더링됩니다.
