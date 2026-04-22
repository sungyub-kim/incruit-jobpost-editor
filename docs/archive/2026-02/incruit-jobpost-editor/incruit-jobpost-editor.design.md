# Design: incruit-jobpost-editor

> 웹 기반 3단 에디터 - 상세 설계 문서

## 1. 시스템 아키텍처

### 1.1 전체 구조
```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Chrome)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┬──────────────────────┬─────────────────┐       │
│  │ FilePanel   │    EditorPanel       │   ChatPanel     │       │
│  │             │                      │                 │       │
│  │ FileTree    │ ┌────┬────┬────────┐ │ MessageList     │       │
│  │ Component   │ │HTML│ MD │Preview │ │ Component       │       │
│  │             │ └────┴────┴────────┘ │                 │       │
│  │             │ CodeMirror Editor    │ ChatInput       │       │
│  │             │                      │ Component       │       │
│  └─────────────┴──────────────────────┴─────────────────┘       │
├─────────────────────────────────────────────────────────────────┤
│                        State Management                          │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐    │
│  │ FileStore    │ EditorStore  │ ChatStore    │ UIStore    │    │
│  └──────────────┴──────────────┴──────────────┴────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                     File System Access API                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ FileSystemDirectoryHandle / FileSystemFileHandle         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 기술 스택 상세
```yaml
Frontend:
  Framework: Vanilla JavaScript (ES Modules)
  Editor: CodeMirror 6
  Markdown: marked.js + highlight.js
  Styling: Tailwind CSS (CDN)
  Icons: Lucide Icons

File System:
  API: File System Access API (Chrome 86+)
  Fallback: <input type="file"> (읽기 전용)

AI Integration:
  API: OpenAI / Claude API (사용자 키 입력)
  Storage: localStorage (API Key)

Build:
  Bundler: 없음 (ES Modules 직접 사용)
  Deploy: 정적 파일 호스팅
```

---

## 2. 컴포넌트 설계

### 2.1 파일 구조
```
incruit-jobpost-editor/
├── index.html              # 메인 HTML
├── css/
│   └── styles.css          # 커스텀 스타일
├── js/
│   ├── app.js              # 앱 진입점
│   ├── stores/
│   │   ├── fileStore.js    # 파일 시스템 상태
│   │   ├── editorStore.js  # 에디터 상태
│   │   ├── chatStore.js    # 채팅 상태
│   │   └── uiStore.js      # UI 상태
│   ├── components/
│   │   ├── FilePanel.js    # 파일 탐색기
│   │   ├── FileTree.js     # 폴더 트리
│   │   ├── EditorPanel.js  # 에디터 패널
│   │   ├── Editor.js       # CodeMirror 래퍼
│   │   ├── Preview.js      # 미리보기
│   │   ├── ChatPanel.js    # AI 채팅
│   │   └── ChatMessage.js  # 메시지 컴포넌트
│   ├── services/
│   │   ├── fileService.js  # 파일 I/O
│   │   └── aiService.js    # AI API 호출
│   └── utils/
│       ├── events.js       # 이벤트 버스
│       └── helpers.js      # 유틸리티
└── assets/
    └── icons/              # 아이콘 (선택)
```

### 2.2 컴포넌트 상세

#### FilePanel (1단)
```javascript
// 상태
{
  rootHandle: FileSystemDirectoryHandle | null,
  tree: FileNode[],
  selectedFile: string | null,
  expandedFolders: Set<string>,
  searchQuery: string,
  filter: string[] // ['.html', '.md']
}

// FileNode 구조
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  handle: FileSystemHandle;
  children?: FileNode[];
  isExpanded?: boolean;
}

// 메서드
- openFolder(): Promise<void>     // 폴더 선택 다이얼로그
- buildTree(): Promise<FileNode[]> // 재귀적 트리 구성
- selectFile(path): void          // 파일 선택
- createFile(name, type): void    // 새 파일 생성
- renameFile(path, newName): void // 이름 변경
- moveFile(from, to): void        // 드래그 이동
```

#### EditorPanel (2단)
```javascript
// 상태
{
  currentFile: {
    path: string,
    content: string,
    language: 'html' | 'markdown',
    isDirty: boolean
  },
  activeTab: 'html' | 'markdown' | 'preview',
  editorInstance: EditorView | null
}

// 메서드
- loadFile(fileNode): Promise<void>
- saveFile(): Promise<void>
- switchTab(tab): void
- updatePreview(): void
- insertText(text): void  // AI 응답 삽입용
```

#### ChatPanel (3단)
```javascript
// 상태
{
  messages: ChatMessage[],
  isLoading: boolean,
  apiKey: string | null,
  provider: 'openai' | 'claude'
}

// ChatMessage 구조
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// 메서드
- sendMessage(content): Promise<void>
- setApiKey(key): void
- clearHistory(): void
- insertToEditor(code): void  // 코드 에디터에 삽입
```

---

## 3. 상태 관리

### 3.1 Simple Store Pattern
```javascript
// stores/createStore.js
export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState: () => state,
    setState: (partial) => {
      state = { ...state, ...partial };
      listeners.forEach(fn => fn(state));
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
```

### 3.2 Store 인스턴스
```javascript
// stores/index.js
export const fileStore = createStore({
  rootHandle: null,
  tree: [],
  selectedFile: null
});

export const editorStore = createStore({
  currentFile: null,
  activeTab: 'html',
  isDirty: false
});

export const chatStore = createStore({
  messages: [],
  isLoading: false,
  apiKey: localStorage.getItem('ai_api_key')
});
```

---

## 4. File System Access API 사용

### 4.1 폴더 열기
```javascript
// services/fileService.js
export async function openDirectory() {
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite'
    });
    return handle;
  } catch (err) {
    if (err.name === 'AbortError') return null;
    throw err;
  }
}
```

### 4.2 파일 읽기
```javascript
export async function readFile(fileHandle) {
  const file = await fileHandle.getFile();
  return await file.text();
}
```

### 4.3 파일 쓰기
```javascript
export async function writeFile(fileHandle, content) {
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
```

### 4.4 트리 빌드
```javascript
export async function buildFileTree(dirHandle, path = '') {
  const entries = [];

  for await (const [name, handle] of dirHandle) {
    const entryPath = path ? `${path}/${name}` : name;

    if (handle.kind === 'directory') {
      entries.push({
        name,
        path: entryPath,
        type: 'directory',
        handle,
        children: await buildFileTree(handle, entryPath)
      });
    } else {
      // 확장자 필터링
      if (name.endsWith('.html') || name.endsWith('.md')) {
        entries.push({
          name,
          path: entryPath,
          type: 'file',
          handle
        });
      }
    }
  }

  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
```

---

## 5. CodeMirror 6 설정

### 5.1 에디터 초기화
```javascript
// components/Editor.js
import { EditorView, basicSetup } from 'codemirror';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

export function createEditor(container, options = {}) {
  const { language = 'html', content = '', onChange } = options;

  const extensions = [
    basicSetup,
    oneDark,
    language === 'html' ? html() : markdown(),
    EditorView.updateListener.of(update => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
    })
  ];

  return new EditorView({
    doc: content,
    extensions,
    parent: container
  });
}
```

### 5.2 CDN 로드 (index.html)
```html
<script type="importmap">
{
  "imports": {
    "codemirror": "https://esm.sh/codemirror@6",
    "@codemirror/lang-html": "https://esm.sh/@codemirror/lang-html",
    "@codemirror/lang-markdown": "https://esm.sh/@codemirror/lang-markdown",
    "@codemirror/theme-one-dark": "https://esm.sh/@codemirror/theme-one-dark",
    "marked": "https://esm.sh/marked"
  }
}
</script>
```

---

## 6. AI 서비스 통합

### 6.1 API 호출
```javascript
// services/aiService.js
export async function sendMessage(messages, apiKey, provider = 'openai') {
  const url = provider === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.anthropic.com/v1/messages';

  const headers = {
    'Content-Type': 'application/json',
    ...(provider === 'openai'
      ? { 'Authorization': `Bearer ${apiKey}` }
      : { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
    )
  };

  const body = provider === 'openai'
    ? { model: 'gpt-4', messages }
    : { model: 'claude-3-sonnet-20240229', messages, max_tokens: 4096 };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error('API 호출 실패');

  const data = await response.json();
  return provider === 'openai'
    ? data.choices[0].message.content
    : data.content[0].text;
}
```

### 6.2 컨텍스트 구성
```javascript
export function buildContext(currentFile) {
  return `현재 편집 중인 파일: ${currentFile.path}
파일 유형: ${currentFile.language}
파일 내용:
\`\`\`${currentFile.language}
${currentFile.content}
\`\`\`

이 파일에 대한 질문이나 수정 요청을 해주세요.`;
}
```

---

## 7. 레이아웃 CSS

### 7.1 3단 레이아웃
```css
/* css/styles.css */
:root {
  --panel-file: 250px;
  --panel-chat: 350px;
  --header-height: 48px;
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --border-color: #3c3c3c;
  --text-primary: #cccccc;
}

.app-container {
  display: grid;
  grid-template-columns: var(--panel-file) 1fr var(--panel-chat);
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.panel {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.panel-header {
  height: var(--header-height);
  padding: 0 16px;
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.panel-content {
  flex: 1;
  overflow: auto;
}

/* 리사이즈 핸들 */
.resize-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
}

.resize-handle:hover {
  background: #007acc;
}
```

---

## 8. 이벤트 흐름

### 8.1 파일 열기 플로우
```
[사용자] 폴더 열기 클릭
    ↓
[FilePanel] showDirectoryPicker() 호출
    ↓
[FileService] 권한 획득, 핸들 저장
    ↓
[FileService] buildFileTree() 재귀 호출
    ↓
[FileStore] tree 상태 업데이트
    ↓
[FileTree] 리렌더링
```

### 8.2 파일 편집 플로우
```
[사용자] 파일 트리에서 파일 클릭
    ↓
[FilePanel] selectFile(path) 호출
    ↓
[FileService] readFile(handle) 호출
    ↓
[EditorStore] currentFile 업데이트
    ↓
[EditorPanel] CodeMirror 내용 교체
    ↓
[사용자] 편집 중...
    ↓
[CodeMirror] onChange 이벤트
    ↓
[EditorStore] isDirty = true
    ↓
[사용자] Ctrl+S 저장
    ↓
[FileService] writeFile(handle, content)
    ↓
[EditorStore] isDirty = false
```

### 8.3 AI 채팅 플로우
```
[사용자] 메시지 입력 후 전송
    ↓
[ChatPanel] sendMessage() 호출
    ↓
[ChatStore] messages에 user 메시지 추가
    ↓
[AIService] 현재 파일 컨텍스트 포함하여 API 호출
    ↓
[AIService] 응답 수신
    ↓
[ChatStore] messages에 assistant 메시지 추가
    ↓
[ChatPanel] 리렌더링
    ↓
[사용자] "코드 삽입" 버튼 클릭 (선택)
    ↓
[EditorPanel] insertText(code)
```

---

## 9. 구현 순서

### Phase 1: 기본 구조 (MVP)
1. `index.html` - 3단 레이아웃 HTML 구조
2. `css/styles.css` - 기본 레이아웃 스타일
3. `js/app.js` - 앱 초기화
4. `js/stores/` - 상태 관리 기본 구조
5. `js/services/fileService.js` - 폴더 열기, 파일 읽기
6. `js/components/FilePanel.js` - 파일 트리 표시
7. `js/components/FileTree.js` - 트리 컴포넌트

### Phase 2: 에디터
1. `js/components/EditorPanel.js` - 에디터 컨테이너
2. `js/components/Editor.js` - CodeMirror 통합
3. `js/components/Preview.js` - HTML/MD 미리보기
4. 탭 전환 기능
5. 파일 저장 기능

### Phase 3: AI 채팅
1. `js/components/ChatPanel.js` - 채팅 UI
2. `js/components/ChatMessage.js` - 메시지 컴포넌트
3. `js/services/aiService.js` - API 연동
4. API 키 설정 UI
5. 컨텍스트 공유 기능

### Phase 4: 추가 기능
1. 파일 생성
2. 이름 변경
3. 드래그 앤 드롭
4. 검색/필터
5. 자동 저장

---

## 10. 브라우저 호환성 체크

```javascript
// js/utils/helpers.js
export function checkBrowserSupport() {
  const features = {
    fileSystemAccess: 'showDirectoryPicker' in window,
    esModules: 'noModule' in document.createElement('script'),
    importMaps: HTMLScriptElement.supports?.('importmap')
  };

  if (!features.fileSystemAccess) {
    alert('이 앱은 Chrome 86 이상에서만 동작합니다.');
    return false;
  }

  return true;
}
```

---

*Created: 2026-02-05*
*Status: Design Phase*
*Based on: incruit-jobpost-editor.plan.md*
