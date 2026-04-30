/* fair-firebase-config.js (예시 — 실제 파일로 복사 후 값 채워서 사용)
 *
 * 사용 방법:
 * 1. https://firebase.google.com 에서 프로젝트 생성 (10~15분)
 * 2. Firestore Database 활성화 (테스트 모드)
 * 3. 프로젝트 설정 → 웹앱 추가 → firebaseConfig 복사
 * 4. 이 파일을 fair-firebase-config.js 로 복사 후 아래 값 교체
 * 5. 새로고침 → 자동 연동
 *
 * 미생성 상태에서는 빌더 정적 모드로 동작 (사용 통계/핀 동기 X) */
window.FAIR_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "fair-builder-xxx.firebaseapp.com",
  projectId: "fair-builder-xxx",
  storageBucket: "fair-builder-xxx.appspot.com",
  messagingSenderId: "...",
  appId: "1:..."
};
