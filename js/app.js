/**
 * Incruit Jobpost Editor - Main Application
 * 채용공고 문서 → 인크루트 템플릿 변환 에디터
 */
import { marked } from 'marked';
import { extractFromUrl, extractFromUrls, extractUrlsFromText, isValidUrl, analyzePageStructure, registerDynamicParser, detectUrlType } from './services/urlExtractor.js';
import { extractFromFile } from './services/fileExtractor.js';
import { convertByRules } from './services/ruleConverter.js';
import { initWorkspaces, getRegistry, getActiveId, setActiveId,
         createWorkspace, deleteWorkspace, renameWorkspace, wsKey, wsKeyFor,
         getMaxWorkspaces, getWorkspaceName } from './services/workspaceManager.js';
import { initIcons, createIcon, ICON_NAMES } from './utils/icons.js';
import { searchKvImages as searchKvImagesLib, detectCategory, getUnsplashCollection, LOCAL_KV_IMAGES, KV_CATEGORIES } from './services/imageLibrary.js';
import * as imageDB from './services/imageDB.js';
import { INCRUIT_SAMPLE_IMAGES } from './services/incruitSampleImages.js';

// ============================================
// Version & Build
// ============================================
const APP_VERSION = '2.0';
const APP_BUILD = 418;      // 수정 시 +1 증가

// URL 쿼리로 파이프라인 버전 제어 (?pipeline=v2 또는 ?pipeline=v1)
// 사용: https://ai-studio.incru.it/?pipeline=v2
(() => {
  const p = new URLSearchParams(window.location.search).get('pipeline');
  if (p === 'v2') localStorage.setItem('pipeline_version', 'v2');
  if (p === 'v1') localStorage.removeItem('pipeline_version');
})();
const APP_BUILD_DATE = '2026-04-21';


// ============================================================
// [추가] app.js 최상단에 삽입 — 서버 URL 상수 2개
// 개발환경(localhost)  → 각 포트에 직접 접속
// 운영환경(EC2 등)     → Nginx 상대경로 사용 (빈 문자열)
// ============================================================
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const CONVERT_SERVER_URL = IS_LOCAL ? 'http://localhost:8082' : '';  // HWP 변환 서버
const CONVERT_HEALTH_URL = IS_LOCAL ? 'http://localhost:8082/health' : '/api/health';
const PROXY_SERVER_URL   = IS_LOCAL ? 'http://localhost:8787' : '';  // CORS 프록시 서버
const PROXY_HEALTH_URL   = IS_LOCAL ? 'http://localhost:8787/health' : '/proxy/health';
const ENCODE_URL         = IS_LOCAL ? 'http://localhost:8787/encode' : '/proxy/encode'; // EUC-KR 인코딩

// ============================================
// Templates (인크루트 스타일)
// ============================================
const templates = {
  standard: {
    name: 'Standard (기본형)',
    render: (data) => `
<div id="templwrap_v3">
  <div class="templ_header none">
    <h2></h2>
    <h3></h3>
  </div>
  <div class="templ_content">
    ${data.content}
  </div>
  <div class="h20"></div>
  <div style="display:none"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>
</div>
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_basic3_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_button_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2022/css/job_post_v3_list_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_media_minify.css?${getCacheBuster()}">
<style>
  #templwrap_v3 .title_bg .sec_title_icon span {background:#0046ff;}
  #templwrap_v3 .bTable_1 th{color: #ffffff; background: #0046ff;}
</style>`
  },
  standard_border: {
    name: 'Standard 이미지 보더형',
    render: (data) => {
      const borderRepeatImg = state.borderRepeatImgUrl || 'https://c.incru.it/newjobpost/2026/04_win-win/win-win_02.png';
      const borderBottomImg = state.borderBottomImgUrl || 'https://c.incru.it/newjobpost/2026/04_win-win/win-win_03.png';
      const borderPad = state.borderPadding || 40;
      return `
<div id="templwrap_v3">
  ${data.keyVisual ? `<div class="templ_header">
    <img src="${data.keyVisual}" class="top_img_v2" alt="채용공고 키비주얼">
  </div>` : ''}
  <div class="templ_header none">
    <h2></h2>
  </div>
  <div class="templ_content">
    ${data.content}
    <div class="h20"></div>
  </div>
  <img src="${borderBottomImg}" style="width:100%;display:block">
  <div class="h20"></div>
  <div style="display:none"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>
</div>
<input id="isIncruit" value="Y" type="hidden">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_basic3_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_button_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2022/css/job_post_v3_list_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_media_minify.css?${getCacheBuster()}">
<style>
  #templwrap_v3 .templ-bottom-btn { text-align: center; padding: 0 4.444%; }
  #templwrap_v3 .bTable_1 th { background: #f1f5f9 !important; color: #000000 !important; }
  #templwrap_v3 .bTable_1 td { border-color: #e5e5e5; }
  #templwrap_v3 .sec_title_icon span { background-color: #0066cc !important; display: block !important; }
  #templwrap_v3 .templ_content { background: url(${borderRepeatImg}) repeat-y; background-size: 100%; padding: 0 ${borderPad}px; }
  #templwrap_v3 .sec_wrap { padding: 0 ${borderPad}px; }
</style>`;
    }
  },
  pass_fail: {
    name: '합불페이지',
    render: (data) => `
<div id="templwrap_v3" class="result">
  <div class="templ_content">
    ${data.content}
  </div>
  <div class="h20"></div>
  <div style="display:none"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>
</div>
<input style="margin: 0px; padding: 0px; border: 0px currentColor; width: 0px; height: 0px; font-size: 0px;" id="isIncruit" value="Y" type="hidden">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_basic3_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2022/css/job_post_v3_list_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_button_minify.css?${getCacheBuster()}">
<style>
  #templwrap_v3.result {max-width:698px;}
  #templwrap_v3 .templ_header h2 > span {color:#33423f;}
  #templwrap_v3 .sec_title_wrap h3{color:${state.colorPrimary};}
  #templwrap_v3 .bTable_1 th {background-color: #33423f; color: #fff;}
  #templwrap_v3 .temp_btn{background:#33423f;}
  #templwrap_v3 th { background-color: #f1f5f9 !important; color: #000000 !important; }
  #templwrap_v3 .sec_title_icon span { background-color: ${state.colorPrimary} !important; display: block !important; }
  #templwrap_v3 .title_bg .sec_title_icon .bul_2{margin-right: 5px;}
  #templwrap_v3.result .templ_header h2, #templwrap_v3.result .templ_header h2 *{font-size: 30px; margin-top: 10px;}
</style>`
  },
  incruit: {
    name: 'Incruit Official',
    render: (data) => `
<div class="incruit-official" style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 860px; margin: 0 auto; background: #fff;">
  ${data.keyVisual ? `<div class="key-visual" style="margin-bottom: 20px; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);"><img src="${data.keyVisual}" alt="채용공고" style="width: 100%; display: block;"></div>` : ''}
  <div class="job-content" style="line-height: 1.8;">${data.content}</div>
  <div class="job-footer" style="margin-top: 32px; padding: 20px; background: #f8f9fa; border-radius: 8px; text-align: center;"><p style="margin: 0; color: #666; font-size: 14px;">본 채용공고는 인크루트를 통해 게시되었습니다.</p></div>
</div>`
  },
  modern: {
    name: 'Modern (모던형)',
    render: (data) => `
<div class="incruit-modern" style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 720px; margin: 0 auto; padding: 40px 20px;">
  ${data.keyVisual ? `<div class="key-visual" style="margin-bottom: 48px;"><img src="${data.keyVisual}" alt="채용공고" style="width: 100%; height: 280px; object-fit: cover; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);"></div>` : ''}
  <div class="job-content" style="line-height: 2;">${data.content}</div>
</div>`
  },
  corporate: {
    name: 'Corporate (기업형)',
    render: (data) => `
<div class="incruit-corporate" style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 900px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 4px;">
  ${data.keyVisual ? `<div class="key-visual"><img src="${data.keyVisual}" alt="채용공고" style="width: 100%; max-height: 200px; object-fit: cover;"></div>` : ''}
  <div class="job-content" style="padding: 24px; line-height: 1.7;">${data.content}</div>
  <div class="job-footer" style="padding: 16px 24px; background: #f5f5f5; border-top: 1px solid #e0e0e0;"><p style="margin: 0; font-size: 12px; color: #888;">채용공고 번호: ${data.jobNumber || '-'}</p></div>
</div>`
  },
  creative: {
    name: 'Creative (크리에이티브)',
    render: (data) => `
<div class="incruit-creative" style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 800px; margin: 0 auto; background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%); padding: 32px; border-radius: 20px;">
  ${data.keyVisual ? `<div class="key-visual" style="margin: -32px -32px 32px -32px;"><img src="${data.keyVisual}" alt="채용공고" style="width: 100%; height: 300px; object-fit: cover; border-radius: 20px 20px 0 0;"></div>` : ''}
  <div class="job-content" style="line-height: 1.9;">${data.content}</div>
</div>`
  },
  compact: {
    name: 'Compact (간결형)',
    render: (data) => `
<div class="incruit-compact" style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 700px; margin: 0 auto; font-size: 14px; line-height: 1.6;">
  ${data.keyVisual ? `<div class="key-visual" style="margin-bottom: 16px;"><img src="${data.keyVisual}" alt="채용공고" style="width: 100%; max-height: 150px; object-fit: cover; border-radius: 4px;"></div>` : ''}
  <div class="job-content">${data.content}</div>
</div>`
  },
  incruit_it: {
    name: 'IT 산업 (Teal)',
    render: (data) => renderIncruitTemplate(data, 'tpl-it01', '#1badc7', '#12434c')
  },
  incruit_startup: {
    name: '스타트업 (Blue)',
    render: (data) => renderIncruitTemplate(data, 'tpl-startup02', '#008aff', '#1270bf')
  },
  incruit_mint: {
    name: '스타트업 (Mint)',
    render: (data) => renderIncruitTemplate(data, 'tpl-startup01', '#81deb5', '#1a6e46')
  },
  incruit_biz: {
    name: '비즈니스 (Brown)',
    render: (data) => renderIncruitTemplate(data, 'tpl-business04', '#422c1c', '#422c1c')
  },
  incruit_classic: {
    name: '클래식 (Orange)',
    render: (data) => renderIncruitTemplate(data, 'tpl-default', '#ff460a', '#d63a00')
  },
  incruit_news: {
    name: '뉴스 (Orange BG)',
    render: (data) => {
      const bullet = state.bulletStyle || 'chevron';
      return `
<div class="tempNew-wrap tpl-tempNew03" data-bullet="${bullet}" style="--tpl-accent:#ff460a;--tpl-title-color:#d63a00;">
  <div class="tempNew03-header">
    <img src="https://i.incru.it/ui/static/image/jobTemp/tempNew03_header.jpg" alt="" style="width:100%;display:block;">
  </div>
  <div class="tempNew-container">
    <div class="job-content" style="color:#333;">${data.content}</div>
  </div>
  <div style="margin-top:32px;padding:16px 30px;background:#f8f9fa;border-top:1px solid #eee;text-align:center;">
    <p style="margin:0;color:#999;font-size:13px;">본 채용공고는 인크루트를 통해 게시되었습니다.</p>
  </div>
</div>`;
    }
  }
};

function renderIncruitTemplate(data, themeClass, accentColor, titleColor) {
  const bullet = state.bulletStyle || 'chevron';
  return `
<div class="tempNew-wrap ${themeClass}" data-bullet="${bullet}" style="--tpl-accent:${accentColor};--tpl-title-color:${titleColor};">
  ${data.keyVisual ? `<div class="tempNew-head" style="padding:0;border:0;"><img src="${data.keyVisual}" alt="채용공고" style="width:100%;display:block;"></div>` : ''}
  <div class="tempNew-container">
    <div class="job-content" style="color:#333;">${data.content}</div>
  </div>
  <div style="margin-top:32px;padding:16px 30px;background:#f8f9fa;border-top:1px solid #eee;text-align:center;">
    <p style="margin:0;color:#999;font-size:13px;">본 채용공고는 인크루트를 통해 게시되었습니다.</p>
  </div>
</div>`;
}

// ============================================
// AI Provider Configuration
// ============================================
const AI_PROVIDERS = {
  openai: {
    name: 'ChatGPT',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (추천)', default: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (빠름)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o3-mini', name: 'o3-mini (추론)' }
    ],
    apiKeyHelp: 'https://platform.openai.com/api-keys',
    apiKeyPlaceholder: 'sk-...',
    color: '#10a37f'
  },
  claude: {
    name: 'Claude',
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (추천)', default: true },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (빠름)' }
    ],
    apiKeyHelp: 'https://console.anthropic.com/settings/keys',
    apiKeyPlaceholder: 'sk-ant-...',
    color: '#d97757'
  },
  gemini: {
    name: 'Gemini',
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (최고성능)', default: true },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (추천)' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (안정)' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (안정)' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (빠름)' }
    ],
    apiKeyHelp: 'https://aistudio.google.com/app/apikey',
    apiKeyPlaceholder: 'AIza...',
    color: '#4285f4'
  }
};

// ============================================
// KV Template Presets
// ============================================
const KV_PRESETS = {
  cleanCorporate: {
    name: '깔끔한 기업형',
    templateType: 'overlay', textAlign: 'left', effect: 'gradient', heightMode: 'fixed',
    bgColor: '#1a2332', brandColor: '#16213d', textShadow: 'light',
    fieldStyles: {
      jobCode:     { fontSize: 12, color: '#E0E0E0', bold: false },
      title:       { fontSize: 46, color: '#FFFFFF', bold: true },
      description: { fontSize: 14, color: '#D0D0D0', bold: false },
      dateCompany: { fontSize: 11, color: '#B0B0B0', bold: false }
    },
    textPosition: { jobCode: { left: 40, top: 25 }, title: { left: 40, top: 60 }, description: { left: 40, top: 220 }, dateCompany: { left: 40, top: 275 } }
  },
  startupVibe: {
    name: '스타트업 감성',
    templateType: 'split', splitLayout: 'text-left', textAlign: 'left', effect: 'none', heightMode: 'fixed',
    bgColor: '#6366f1', brandColor: '#f8fafc', textShadow: 'none',
    fieldStyles: {
      jobCode:     { fontSize: 12, color: '#6366f1', bold: false },
      title:       { fontSize: 40, color: '#1e293b', bold: true },
      description: { fontSize: 14, color: '#475569', bold: false },
      dateCompany: { fontSize: 11, color: '#64748b', bold: false }
    },
    textPosition: { jobCode: { left: 30, top: 30 }, title: { left: 30, top: 60 }, description: { left: 30, top: 220 }, dateCompany: { left: 30, top: 280 } }
  },
  government: {
    name: '공공기관',
    templateType: 'overlay', textAlign: 'left', effect: 'gradient', heightMode: 'fixed',
    bgColor: '#1e3a5f', brandColor: '#16213d', textShadow: 'light',
    fieldStyles: {
      jobCode:     { fontSize: 14, color: '#FFFFFF', bold: true },
      title:       { fontSize: 38, color: '#FFFFFF', bold: true },
      description: { fontSize: 13, color: '#E8E8E8', bold: false },
      dateCompany: { fontSize: 11, color: '#D0D0D0', bold: false }
    },
    textPosition: { jobCode: { left: 35, top: 30 }, title: { left: 35, top: 70 }, description: { left: 35, top: 220 }, dateCompany: { left: 35, top: 275 } }
  },
  creative: {
    name: '크리에이티브',
    templateType: 'overlay', textAlign: 'center', effect: 'diagonal', heightMode: 'fixed',
    bgColor: '#ec4899', brandColor: '#be185d', textShadow: 'medium',
    fieldStyles: {
      jobCode:     { fontSize: 13, color: '#fce7f3', bold: false },
      title:       { fontSize: 52, color: '#FFFFFF', bold: true },
      description: { fontSize: 15, color: '#fce7f3', bold: false },
      dateCompany: { fontSize: 12, color: '#fbcfe8', bold: false }
    },
    textPosition: { jobCode: { left: 30, top: 20 }, title: { left: 30, top: 60 }, description: { left: 30, top: 220 }, dateCompany: { left: 30, top: 275 } }
  },
  minimal: {
    name: '미니멀',
    templateType: 'split', splitLayout: 'text-left', textAlign: 'left', effect: 'none', heightMode: 'fixed',
    bgColor: '#f5f5f5', brandColor: '#ffffff', textShadow: 'none',
    fieldStyles: {
      jobCode:     { fontSize: 11, color: '#9ca3af', bold: false },
      title:       { fontSize: 42, color: '#111827', bold: true },
      description: { fontSize: 13, color: '#6b7280', bold: false },
      dateCompany: { fontSize: 10, color: '#9ca3af', bold: false }
    },
    textPosition: { jobCode: { left: 30, top: 30 }, title: { left: 30, top: 60 }, description: { left: 30, top: 220 }, dateCompany: { left: 30, top: 280 } }
  },
  photoAnnounce01: {
    name: '실사공고01',
    templateType: 'photoTop', textAlign: 'left', effect: 'none', heightMode: 'fluid',
    bgColor: '#F6F6F6', brandColor: '#F6F6F6', textShadow: 'none',
    titleAccentColor: '',
    photoContentBg: '#F6F6F6',
    photoJobCodeTop: 5,
    defaultTitle: '공고제목이 들어갑니다.',
    defaultDescription: '회사에 대한 소개가 들어갑니다.',
    fieldStyles: {
      jobCode:     { fontSize: 15, color: '#ffffff', bold: false },
      orgName:     { fontSize: 42, color: '#111111', bold: true },
      title:       { fontSize: 50, color: '#111111', bold: true },
      description: { fontSize: 15, color: '#121212', bold: false },
      dateCompany: { fontSize: 15, color: '#111111', bold: true }
    }
  },
  photoAnnounce02: {
    name: '실사공고02',
    templateType: 'photoTop2', textAlign: 'left', effect: 'none', heightMode: 'fluid',
    bgColor: '#111111', brandColor: '#111111', textShadow: 'none',
    titleAccentColor: '',
    photoContentBg: '#111111',
    photoJobCodeTop: 5,
    photoRadiusTL: 0, photoRadiusTR: 0, photoRadiusBL: 0, photoRadiusBR: 0,
    defaultTitle: '공고제목이 들어갑니다.',
    defaultDescription: '회사에 대한 소개가 들어갑니다.',
    fieldStyles: {
      jobCode:     { fontSize: 15, color: '#6ec6f5', bold: false },
      orgName:     { fontSize: 45, color: '#ffffff', bold: true },
      title:       { fontSize: 32, color: '#121212', bold: true },
      description: { fontSize: 15, color: '#e0e0e0', bold: false },
      dateCompany: { fontSize: 15, color: '#e0e0e0', bold: true }
    }
  },
  photoAnnounce03: {
    name: '실사공고03',
    templateType: 'photoFull', textAlign: 'center', effect: 'none', heightMode: 'fluid',
    bgColor: '#0a0f1e', brandColor: '#0a0f1e', textShadow: 'none',
    titleAccentColor: '',
    photoContentBg: '#0a0f1e',
    photoContentMinHeight: 500,
    photoJobCodeTop: 5,
    photoRadiusTL: 0, photoRadiusTR: 0, photoRadiusBL: 0, photoRadiusBR: 0,
    defaultTitle: '공고제목이 들어갑니다.',
    defaultDescription: '회사에 대한 소개가 들어갑니다.',
    fieldStyles: {
      jobCode:     { fontSize: 14, color: '#ffffff', bold: false, align: 'center' },
      orgName:     { fontSize: 46, color: '#ffffff', bold: true },
      title:       { fontSize: 46, color: '#6ec6f5', bold: true },
      description: { fontSize: 15, color: '#ffffff', bold: false },
      dateCompany: { fontSize: 15, color: '#ffffff', bold: false }
    }
  },
  photoAnnounce04: {
    name: '실사공고04',
    templateType: 'photoFull', textAlign: 'left', effect: 'none', heightMode: 'fluid',
    bgColor: '#111111', brandColor: '#111111', textShadow: 'none',
    titleAccentColor: '',
    photoContentBg: '#111111',
    photoJobCodeTop: 5,
    photoRadiusTL: 0, photoRadiusTR: 0, photoRadiusBL: 0, photoRadiusBR: 0,
    photoVerticalAlign: 'bottom',
    photoContentPadding: '5% 6% 5%',
    photoOrgNameMarginTop: '17.39%',
    photoDescMargin: '16px 0 0 0',
    photoFooterMargin: '16px 0 0 0',
    defaultTitle: '채용 공고',
    defaultDescription: '회사에 대한 소개가 들어갑니다.',
    forceDefaultDescription: true,
    defaultDescription2: '회사소개 2번째 내용',
    fieldStyles: {
      jobCode:     { fontSize: 14, color: '#ffffff', bold: false },
      orgName:     { fontSize: 52, color: '#ffffff', bold: true, fontFamily: 'GangwonEducationTteontteon', lineHeight: 1.2 },
      title:       { fontSize: 56, color: '#ffffff', bold: true, fontFamily: 'GangwonEducationTteontteon', lineHeight: 1.2 },
      description:  { fontSize: 30, color: '#5ec8e8', bold: false, fontFamily: 'Nanum Pen Script', marginTop: 27 },
      description2: { fontSize: 15, color: '#e0e0e0', fontWeight: 600, bold: false, fontFamily: 'Pretendard Variable', lineHeight: 1.4, marginTop: 16 },
      dateCompany:  { fontSize: 15, color: '#e0e0e0', fontWeight: 600, bold: false, fontFamily: 'Pretendard Variable', lineHeight: 1.4, marginTop: 16, marginBottom: 22 }
    }
  },
  photoAnnounce05: {
    name: '실사공고05',
    templateType: 'photoTop', textAlign: 'left', effect: 'none', heightMode: 'fluid',
    bgColor: '#f5f5f7', brandColor: '#f5f5f7', textShadow: 'none',
    titleAccentColor: '#1a4bbf',
    photoContentBg: '#f5f5f7',
    photoJobCodeTop: 5,
    photoImgHeight: '65%',
    photoFullBg: false,
    photoRadiusTL: 0, photoRadiusTR: 0, photoRadiusBL: 0, photoRadiusBR: 0,
    photoMaskBL: 0,
    photoContentTopRadius: 0,
    photoContentRadiusTL: 0,
    photoContentRadiusTR: 100,
    defaultTitle: '공고제목이 들어갑니다.',
    defaultDescription: '회사에 대한 소개가 들어갑니다.',
    fieldStyles: {
      jobCode:     { fontSize: 14, color: '#ffffff', bold: false },
      orgName:     { fontSize: 26, color: '#333333', fontWeight: 500, fontFamily: 'Gmarket Sans', lineHeight: 1.2 },
      title:       { fontSize: 40, color: '#111111', fontWeight: 700, fontFamily: 'Gmarket Sans', lineHeight: 1.2, marginBottom: 26 },
      description: { fontSize: 15, color: '#121212', fontWeight: 500, fontFamily: 'Gmarket Sans', lineHeight: 1.5, marginBottom: 20, letterSpacing: '-0.15px' },
      dateCompany: { fontSize: 15, color: '#121212', fontWeight: 500, fontFamily: 'Gmarket Sans', lineHeight: 1.5, letterSpacing: '-0.15px' }
    }
  },
  passFailNotice: {
    name: '합불 안내',
    templateType: 'photoFull', textAlign: 'left', effect: 'none', heightMode: 'fluid',
    bgColor: '#0d1117', brandColor: '#0d1117', textShadow: 'none',
    titleAccentColor: '',
    photoContentBg: '#0d1117',
    photoJobCodeTop: 5,
    photoRadiusTL: 0, photoRadiusTR: 0, photoRadiusBL: 0, photoRadiusBR: 0,
    hiddenFields: ['jobCode', 'description', 'dateCompany'],
    photoVerticalAlign: 'center',
    photoOrgNameMarginTop: '0',
    defaultTitle: '서류전형 합격을\n축하드립니다.',
    fieldStyles: {
      jobCode:     { fontSize: 14, color: '#ffffff', bold: false },
      orgName:     { fontSize: 20, color: '#999999', fontWeight: 400, fontFamily: 'Pretendard Variable', lineHeight: 1.3 },
      title:       { fontSize: 44, color: '#ffffff', bold: true, fontFamily: 'Pretendard Variable', lineHeight: 1.3 },
      description: { fontSize: 15, color: '#ffffff', bold: false },
      dateCompany: { fontSize: 15, color: '#ffffff', bold: false }
    }
  }
};

// State Management
// ============================================
const state = {
  // Settings
  bottomButtons: [], // [{ text, href, bgColor, textColor, styleClass }]
  jobNumber: '',
  jobNumberAlign: 'left',
  jobNumberStyle: { fontSize: 14, color: '#333333', bold: false, top: 10 },
  headerCompanyName: '',
  companyNameAlign: 'left',
  companyNameStyle: { fontSize: 14, color: '#333333', bold: false, top: 5 },
  headerDate: '',
  headerDateAlign: 'left',
  headerDateStyle: { fontSize: 12, color: '#333333', bold: false, top: 5 },
  template: 'standard',
  keyVisualUrl: '',
  borderRepeatImgUrl: '',
  borderBottomImgUrl: '',
  borderPadding: 40,
  colorPrimary: '#0066cc',
  colorSecondary: '#333333',
  colorAccent: '#ff6600',
  bulletStyle: 'chevron',

  // 타이틀 스타일 (인크루트 최종 출력용)
  titleStyle: 'iconBg',           // 'iconNumber' | 'iconBg' | 'titleSub'
  iconNumber: '1',                // '1'~'12' (아이콘 숫자 스프라이트)
  iconBg: '1',                    // '1'~'18' (아이콘 배경 스프라이트)
  titleSub: '1',                  // '1'~'8' (서브타이틀 스타일)
  thColor: '#f1f5f9',             // 테이블 th 배경색
  thTextColor: '#000000',         // 테이블 th 텍스트색
  subTitleTextColor: '#000000',   // titleSub 텍스트색
  subTitleLineColor: '#cbd1da',   // titleSub 라인색
  subTitleBgColor: '#e6f2ff',     // titleSub 배경색
  subTitleShadowColor: '#ff460a', // titleSub 그림자색 (c_title_3)

  // Editor
  sourceContent: '',
  convertedHtml: '',
  activeView: 'dual',

  // Original Source (원본 보존)
  originalSource: null,  // restoreSession()에서 wsKey 기반으로 로드
  // { type: 'url'|'file'|'paste'|'html', raw: '...', metadata: {...}, timestamp: number }

  // AI
  apiKey: localStorage.getItem('ai_api_key') || '',
  provider: localStorage.getItem('ai_provider') || 'openai',
  model: localStorage.getItem('ai_model') || '',
  messages: [],
  isLoading: false,
  isConnected: false,
  pdfPageImages: [],       // PDF 첨부 시 렌더링된 페이지 이미지 (Vision 교차 비교용)
  attachedPdfBase64: null, // PDF 첨부 시 base64

  // Image Search API Keys
  unsplashApiKey: localStorage.getItem('unsplash_api_key') || '',
  pexelsApiKey: localStorage.getItem('pexels_api_key') || '',
  pixabayApiKey: localStorage.getItem('pixabay_api_key') || '',
  figmaToken: localStorage.getItem('figma_token') || '',

  // Settings Tab
  activeSettingsTab: 'jobpost',

  // KV Toggle
  kvEnabled: false,

  // 공고 타입
  isWorksPost: false,  // 웍스용 공고 (media CSS 제거)
  isRasp: false,       // 구버전 rasp (templwrap_v3에 class="rasp" 추가)
  isExternalPost: false, // 외부 채용공고 (copyright 이미지 block 표시)
  formattingInfo: null,  // 파일 로드 시 추출한 볼드/밑줄/블릿 서식 정보 {boldTexts, underlineTexts, bulletItems}

  // Edit Mode
  editMode: false,

  // Key Visual
  kv: {
    jobCode: '공고 제2026-0호',
    title: '기업명이 들어갑니다.\n공고명이 들어갑니다.\n최대 3줄까지 가능합니다.',
    description: '회사에 대한 소개가 들어갑니다.\n회사에 대한 소개가 들어갑니다.\n최대 3줄까지 가능합니다.',
    date: '2026년 2월 5일',
    companyName: '기업명',
    templateType: 'overlay',
    splitLayout: 'text-left',
    textAlign: 'left',
    effect: 'gradient',
    heightMode: 'fixed',
    bgColor: '#1f46a8',
    brandColor: '#16213d',
    logoDataUrl: '',
    bgImageDataUrl: '',
    bgImageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    textShadow: 'light', // none | light | medium | strong
    titleAccentColor: '',  // photoTop 프리셋용 강조색
    photoContentBg: '#F6F6F6', // photoTop 전용 배경색
    // Per-field text styles
    fieldStyles: {
      jobCode:     { fontSize: 14, color: '#FFFFFF', bold: false },
      title:       { fontSize: 50, color: '#FFFFFF', bold: true },
      description: { fontSize: 13, color: '#FFFFFF', bold: false },
      dateCompany: { fontSize: 12, color: '#FFFFFF', bold: false }
    },
    // Text position (fixed height mode only)
    textPosition: {
      jobCode:     { left: 30, top: 20 },
      title:       { left: 30, top: 65 },
      description: { left: 30, top: 180 },
      dateCompany: { left: 30, top: 260 }
    },
  }
};

// ============================================
// Work Stats & History (작업 통계 + 히스토리)
// ============================================
const workStats = loadWorkStats();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadWorkStats() {
  const defaultCumulative = {
    totalConversions: 0,    // AI변환 + 빠른변환 합계
    totalUrlExtracts: 0,
    totalCharsProcessed: 0, // 처리한 원문 글자수 누적
    totalCharsGenerated: 0, // 생성한 HTML 글자수 누적
    totalTimeMs: 0,
    firstUsed: null,        // 최초 사용일
    gradeA: 0, gradeB: 0, gradeC: 0, gradeF: 0
  };
  try {
    const raw = localStorage.getItem('work_stats');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.date !== new Date().toISOString().slice(0, 10)) {
        data.date = new Date().toISOString().slice(0, 10);
        data.tasks = [];
      }
      if (!data.history) data.history = [];
      if (!data.cumulative) data.cumulative = { ...defaultCumulative };
      return data;
    }
  } catch { /* ignore */ }
  return { date: new Date().toISOString().slice(0, 10), tasks: [], history: [], cumulative: { ...defaultCumulative } };
}

function saveWorkStats() {
  try {
    localStorage.setItem('work_stats', JSON.stringify(workStats));
  } catch { /* localStorage full */ }
}

function recordTaskStart(type) {
  if (workStats.date !== todayStr()) {
    workStats.date = todayStr();
    workStats.tasks = [];
  }
  const task = {
    id: Date.now(),
    type,
    wsName: '',
    startTime: Date.now(),
    endTime: null,
    duration: null,
    detail: ''
  };
  workStats.tasks.push(task);
  return task.id;
}

function recordTaskEnd(taskId, detail = '') {
  const task = workStats.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.endTime = Date.now();
  task.duration = task.endTime - task.startTime;
  task.detail = detail;
  try {
    task.wsName = getWorkspaceName(getActiveId());
  } catch { /* ignore */ }
  // 누적 시간
  workStats.cumulative.totalTimeMs += (task.duration || 0);
  saveWorkStats();
}

function addWorkHistory(info) {
  workStats.history.push({
    timestamp: Date.now(),
    date: todayStr(),
    wsName: info.wsName || '',
    companyName: info.companyName || '',
    jobTitle: info.jobTitle || '',
    action: info.action || '',
    grade: info.grade || '',
    source: info.source || ''
  });
  if (workStats.history.length > 100) {
    workStats.history = workStats.history.slice(-100);
  }

  // 누적 통계 갱신
  const c = workStats.cumulative;
  if (!c.firstUsed) c.firstUsed = todayStr();
  const action = info.action || '';
  if (action.includes('변환')) c.totalConversions++;
  if (action.includes('URL')) c.totalUrlExtracts++;
  if (info.grade) {
    const g = info.grade.replace(/[^A-F]/g, '');
    if (g === 'A') c.gradeA++;
    else if (g === 'B') c.gradeB++;
    else if (g === 'C') c.gradeC++;
    else if (g === 'F') c.gradeF++;
  }

  saveWorkStats();
}

/** 처리 글자수 누적 기록 (변환 완료 시 호출) */
function recordCharsProcessed(sourceChars, generatedChars) {
  workStats.cumulative.totalCharsProcessed += (sourceChars || 0);
  workStats.cumulative.totalCharsGenerated += (generatedChars || 0);
  saveWorkStats();
}

/** 사용자 입력에서 이름/별명 추출 → localStorage 저장 */
function tryExtractWorkerName(userMsg) {
  if (!userMsg) return;
  // "내 이름은 X야", "X라고 불러", "X입니다", "X요", "X이에요" 등
  const patterns = [
    /(?:이름은?|저는?|나는?)\s*[""'']?([가-힣a-zA-Z]{1,10})[""'']?(?:이야|야|요|이에요|입니다|이요|이라고|라고)/,
    /[""'']?([가-힣a-zA-Z]{1,10})[""'']?\s*(?:이라고|라고)\s*(?:불러|해|해줘|하면)/,
    /[""'']?([가-힣a-zA-Z]{1,10})[""'']?\s*(?:이에요|이야|야|요|입니다)$/
  ];
  for (const p of patterns) {
    const m = userMsg.match(p);
    if (m && m[1]) {
      const name = m[1].trim();
      if (name.length >= 1 && name.length <= 10) {
        localStorage.setItem('worker_name', name);
        console.log('[app] 작업자 이름 저장:', name);
        return;
      }
    }
  }
}

function getTodayStats() {
  if (workStats.date !== todayStr()) {
    workStats.date = todayStr();
    workStats.tasks = [];
  }
  const tasks = workStats.tasks.filter(t => t.endTime);
  const byType = {};
  let totalMs = 0;
  for (const t of tasks) {
    if (!byType[t.type]) byType[t.type] = { count: 0, totalMs: 0 };
    byType[t.type].count++;
    byType[t.type].totalMs += (t.duration || 0);
    totalMs += (t.duration || 0);
  }
  const typeLabels = {
    ai_convert: 'AI 변환',
    rule_convert: '빠른 변환',
    url_extract: 'URL 추출',
    chat: '채팅',
    verify: '검증'
  };
  const lines = [];
  for (const [type, data] of Object.entries(byType)) {
    const label = typeLabels[type] || type;
    lines.push(`${label}: ${data.count}건 (${formatDuration(data.totalMs)})`);
  }
  return {
    taskCount: tasks.length,
    totalMs,
    totalFormatted: formatDuration(totalMs),
    breakdown: lines.join(', '),
    byType
  };
}

function getRecentHistory(limit = 10) {
  const recent = workStats.history.slice(-limit).reverse();
  if (recent.length === 0) return '작업 히스토리 없음';
  return recent.map((h, i) => {
    const time = new Date(h.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const name = h.jobTitle || h.wsName || '(제목 없음)';
    const grade = h.grade ? ` ${h.grade}` : '';
    return `${i + 1}. [${h.date} ${time}] ${h.action} — ${name}${h.companyName ? ` (${h.companyName})` : ''}${grade}`;
  }).join('\n');
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) {
    const remSec = sec % 60;
    return remSec > 0 ? `${min}분 ${remSec}초` : `${min}분`;
  }
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return remMin > 0 ? `${hr}시간 ${remMin}분` : `${hr}시간`;
}

function formatChars(n) {
  if (n < 1000) return `${n}자`;
  if (n < 10000) return `${(n / 1000).toFixed(1)}천자`;
  return `${(n / 10000).toFixed(1)}만자`;
}

function getCumulativeStats() {
  const c = workStats.cumulative;
  const totalJobs = c.totalConversions + c.totalUrlExtracts;
  const totalGraded = c.gradeA + c.gradeB + c.gradeC + c.gradeF;
  const aRate = totalGraded > 0 ? Math.round((c.gradeA / totalGraded) * 100) : 0;

  // 사용 일수 계산
  let daysSince = 0;
  if (c.firstUsed) {
    const first = new Date(c.firstUsed);
    const now = new Date();
    daysSince = Math.max(1, Math.floor((now - first) / (1000 * 60 * 60 * 24)) + 1);
  }

  return {
    totalJobs,
    totalConversions: c.totalConversions,
    totalUrlExtracts: c.totalUrlExtracts,
    totalCharsProcessed: c.totalCharsProcessed,
    totalCharsGenerated: c.totalCharsGenerated,
    totalTimeMs: c.totalTimeMs,
    totalTimeFormatted: formatDuration(c.totalTimeMs),
    gradeA: c.gradeA, gradeB: c.gradeB, gradeC: c.gradeC, gradeF: c.gradeF,
    aRate,
    firstUsed: c.firstUsed || todayStr(),
    daysSince,
    summary: totalJobs > 0
      ? `전체: ${totalJobs}건 처리 (변환 ${c.totalConversions}건, URL추출 ${c.totalUrlExtracts}건) · 원문 ${formatChars(c.totalCharsProcessed)} 처리 · HTML ${formatChars(c.totalCharsGenerated)} 생성 · 총 ${formatDuration(c.totalTimeMs)} · A등급 ${aRate}% (${daysSince}일간)`
      : '전체: 아직 작업 기록 없음'
  };
}

// ============================================
// DOM Elements
// ============================================
const elements = {
  // Settings
  jobNumber: document.getElementById('job-number'),
  headerCompanyName: document.getElementById('header-company-name'),
  headerDate: document.getElementById('header-date'),
  templateSelect: document.getElementById('template-select'),
  keyVisualUrl: document.getElementById('key-visual-url'),
  keyVisualPreview: document.getElementById('key-visual-preview'),
  colorPrimary: document.getElementById('color-primary'),
  colorSecondary: document.getElementById('color-secondary'),
  colorAccent: document.getElementById('color-accent'),
  bulletBtns: document.querySelectorAll('.bullet-btn'),

  // Action Buttons
  btnRuleConvert: document.getElementById('btn-rule-convert'),
  btnConvert: document.getElementById('btn-convert'),
  btnCopyHtml: document.getElementById('btn-copy-html'),
  btnDownload: document.getElementById('btn-download'),

  // Editor
  sourceEditor: document.getElementById('source-editor'),
  originalContainer: document.getElementById('original-container'),
  originalViewer: document.getElementById('original-viewer'),
  sourceContainer: document.getElementById('source-container'),
  previewContainer: document.getElementById('preview-container'),
  codeContainer: document.getElementById('code-container'),
  imagemapContainer: document.getElementById('imagemap-container'),
  previewContent: document.getElementById('preview-content'),
  htmlCode: document.getElementById('html-code'),
  templateName: document.getElementById('template-name'),
  viewBtns: document.querySelectorAll('[data-view]'),
  btnClearSource: document.getElementById('btn-clear-source'),

  // Chat
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input'),
  btnSend: document.getElementById('btn-send'),
  btnAiSettings: document.getElementById('btn-ai-settings'),
  btnClearChat: document.getElementById('btn-clear-chat'),
  statusText: document.getElementById('status-text'),
  quickActionBtns: document.querySelectorAll('.quick-action-btn'),

  // Modal
  aiSettingsModal: document.getElementById('ai-settings-modal'),
  aiProvider: document.getElementById('ai-provider'),
  aiApiKey: document.getElementById('ai-api-key'),
  aiModel: document.getElementById('ai-model'),
  providerCards: document.querySelectorAll('.ai-provider-card'),
  btnTestConnection: document.getElementById('btn-test-connection'),
  btnToggleKey: document.getElementById('btn-toggle-key'),
  connectionStatus: document.getElementById('connection-status'),
  modelSelection: document.getElementById('model-selection'),
  apiKeyLabel: document.getElementById('api-key-label'),
  apiKeyHelpLink: document.getElementById('api-key-help-link'),
  btnRefreshModels: document.getElementById('btn-refresh-models'),
  refreshModelsText: document.getElementById('refresh-models-text'),
  modelFetchStatus: document.getElementById('model-fetch-status')
};


// ============================================
// HTML Sanitization Helper
// ============================================

/**
 * 외부/사용자 콘텐츠를 안전하게 innerHTML에 삽입 (XSS 방지)
 * DOMPurify CDN이 index.html에서 로드됨을 전제.
 */
function safeSetHtml(element, html) {
  if (!element) return;
  element.innerHTML = DOMPurify.sanitize(html || '', {
    ADD_TAGS: ['style', 'link'],
    ADD_ATTR: ['target', 'rel', 'class', 'id', 'style', 'data-hr-property', 'data-incruit-field', 'colspan', 'rowspan', 'href', 'src', 'alt', 'width', 'height'],
    ALLOW_DATA_ATTR: true,
  });
}

// ============================================
// Original Source Management (원본 보존)
// ============================================
function saveOriginalSource(type, html, metadata = {}) {
  state.originalSource = {
    type,        // 'url' | 'file' | 'paste' | 'html'
    raw: html,
    metadata,    // { filename, url, title, company, ... }
    timestamp: Date.now()
  };
  try {
    localStorage.setItem(wsKey('original_source'), JSON.stringify(state.originalSource));
  } catch { /* localStorage full — ignore */ }
}

function clearOriginalSource() {
  state.originalSource = null;
  state.formattingInfo = null;
  localStorage.removeItem(wsKey('original_source'));
}

function restoreOriginalSource() {
  if (!state.originalSource) return;
  safeSetHtml(elements.sourceEditor, state.originalSource.raw);
  state.sourceContent = state.originalSource.raw;
  updateLivePreview();
}

// 공통 입력 처리: 원문 저장 → 변환문에 임시 표시 → 미리보기 갱신
// 변환은 사용자가 보내기 버튼(convert 액션)으로 직접 트리거
function processInputSource(html, metadata = {}) {
  // 1. 원문 저장
  saveOriginalSource(metadata.type || 'file', html, metadata);
  // 2. sourceEditor에 원문 임시 표시 (변환 전까지)
  safeSetHtml(elements.sourceEditor, html);
  state.sourceContent = html;
  // 3. 듀얼 뷰로 전환
  setViewAndActivateTab('dual');
  // 4. 로컬 미리보기 갱신 (변환은 사용자가 트리거)
  updateLivePreview();
  // 5. 워크스페이스 이름 자동 설정 (기본 이름인 경우)
  const wsName = metadata.company || metadata.title || metadata.filename;
  if (wsName) autoRenameCurrentWorkspace(wsName);
}

function getOriginalSourceLabel() {
  if (!state.originalSource) return '';
  const s = state.originalSource;
  switch (s.type) {
    case 'url': {
      if (!s.metadata?.url) return 'URL';
      const host = new URL(s.metadata.url).hostname;
      // 인크루트 도메인만 표시, 타사는 일반 라벨
      if (host.includes('incruit.com')) return host;
      return '채용공고 URL';
    }
    case 'file': return s.metadata?.filename || '파일';
    case 'paste': return '붙여넣기';
    case 'html': return 'HTML';
    default: return '원본';
  }
}

// ============================================
// HTML Code Input (HTML 코드 입력 기능)
// ============================================

/**
 * 인크루트 템플릿으로 이미 변환된 HTML인지 감지
 */
function isIncruitFormattedHtml(html) {
  // 인크루트 템플릿 래퍼 클래스 감지
  return /id="templwrap_v3"/.test(html)
    || /class="[^"]*(?:incruit-official|incruit-modern|incruit-corporate|incruit-creative|incruit-compact)[^"]*"/.test(html)
    || /class="[^"]*tpl-(?:it|startup|biz|medical|finance|edu|mfg|food|logistics|beauty)[^"]*"/.test(html)
    || /data-hr-property=/.test(html)
    || /c\.incru\.it\/HR\/jobtemp/.test(html);
}

/**
 * 인크루트 템플릿 래퍼를 제거하고 내부 JD 콘텐츠만 추출
 */
function extractInnerJobContent(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // v3 template: .templ_content 내부
  const v3Content = doc.querySelector('.templ_content');
  if (v3Content) return v3Content.innerHTML.trim();
  // 커스텀 템플릿: .job-content 내부
  const jobContent = doc.querySelector('.job-content');
  if (jobContent) return jobContent.innerHTML.trim();
  // data-hr-property 래퍼가 있으면 모아서 반환
  const hrSections = doc.querySelectorAll('[data-hr-property]');
  if (hrSections.length > 0) {
    return Array.from(hrSections).map(el => el.outerHTML).join('\n');
  }
  // 감지 실패: body 전체 반환
  return doc.body.innerHTML.trim();
}

/**
 * HTML 코드 입력 처리
 * @param {string} htmlCode - raw HTML code
 * @param {'source'|'editor'} mode - 처리 방식
 */
function processHtmlCodeInput(htmlCode, mode) {
  if (!htmlCode.trim()) return;

  const wasConverted = isIncruitFormattedHtml(htmlCode);

  if (mode === 'source') {
    // 원문으로 설정: 템플릿 래퍼 제거 → 콘텐츠 추출 → source-editor에 렌더링
    const content = wasConverted ? extractInnerJobContent(htmlCode) : htmlCode;
    saveOriginalSource('html', htmlCode, { wasConverted, htmlImported: true });
    processInputSource(content, { type: 'html', wasConverted, htmlImported: true });
  } else if (mode === 'editor') {
    // 코드 편집기로 바로 열기: AI 변환 없이 직접 로드
    saveOriginalSource('html', htmlCode, { wasConverted, htmlImported: true });
    state.convertedHtml = wasConverted ? extractInnerJobContent(htmlCode) : htmlCode;
    updatePreview();
    updateHtmlCode();
    setViewAndActivateTab('code');
  }
}

/**
 * HTML 코드 모달 열기/닫기
 */
function openHtmlCodeModal() {
  const modal = document.getElementById('html-code-modal');
  const textarea = document.getElementById('html-code-textarea');
  const detectEl = document.getElementById('html-code-detect');
  if (!modal) return;
  textarea.value = '';
  detectEl.classList.add('hidden');
  detectEl.textContent = '';
  modal.classList.remove('hidden');
  textarea.focus();
}

function closeHtmlCodeModal() {
  const modal = document.getElementById('html-code-modal');
  if (modal) modal.classList.add('hidden');
}

/**
 * HTML 코드 입력량 변화 시 감지 결과 표시
 */
function updateHtmlCodeDetection() {
  const textarea = document.getElementById('html-code-textarea');
  const detectEl = document.getElementById('html-code-detect');
  if (!textarea || !detectEl) return;

  const code = textarea.value.trim();
  if (!code || code.length < 20) {
    detectEl.classList.add('hidden');
    return;
  }

  const wasConverted = isIncruitFormattedHtml(code);
  const hasHtml = /<[a-z][a-z0-9]*[\s>]/i.test(code);

  if (wasConverted) {
    detectEl.textContent = '인크루트 템플릿 HTML 감지됨 — "원문으로 설정" 시 콘텐츠만 추출합니다.';
  } else if (hasHtml) {
    detectEl.textContent = '외부 HTML 감지됨 — 그대로 원문 또는 코드 편집기로 로드합니다.';
  } else {
    detectEl.textContent = 'HTML 태그가 없는 텍스트입니다. HTML 코드를 붙여넣으세요.';
  }
  detectEl.classList.remove('hidden');
}

// ============================================
// Session Persistence (세션 유지)
// ============================================
function saveSession() {
  try {
    const msgs = state.messages.filter(m => !m.isProgress).map(m => ({
      role: m.role, content: m.content,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      diffHtml: m.diffHtml || undefined,
      diffAddCount: m.diffAddCount || undefined,
      diffDelCount: m.diffDelCount || undefined
    }));
    localStorage.setItem(wsKey('session_messages'), JSON.stringify(msgs));
    if (state.convertedHtml) localStorage.setItem(wsKey('session_convertedHtml'), state.convertedHtml);
    else localStorage.removeItem(wsKey('session_convertedHtml'));
    if (state.sourceContent) localStorage.setItem(wsKey('session_sourceContent'), state.sourceContent);
    else localStorage.removeItem(wsKey('session_sourceContent'));
    localStorage.setItem(wsKey('session_kv'), JSON.stringify(state.kv));
    // 추가: 워크스페이스별 설정 저장
    localStorage.setItem(wsKey('bottom_buttons'), JSON.stringify(state.bottomButtons || []));
    localStorage.setItem(wsKey('job_number'), state.jobNumber || '');
    localStorage.setItem(wsKey('job_number_align'), state.jobNumberAlign || 'left');
    localStorage.setItem(wsKey('job_number_style'), JSON.stringify(state.jobNumberStyle));
    localStorage.setItem(wsKey('header_company_name'), state.headerCompanyName || '');
    localStorage.setItem(wsKey('company_name_align'), state.companyNameAlign || 'left');
    localStorage.setItem(wsKey('company_name_style'), JSON.stringify(state.companyNameStyle));
    localStorage.setItem(wsKey('header_date'), state.headerDate || '');
    localStorage.setItem(wsKey('header_date_align'), state.headerDateAlign || 'left');
    localStorage.setItem(wsKey('header_date_style'), JSON.stringify(state.headerDateStyle));
    localStorage.setItem(wsKey('template'), state.template || 'standard');
    localStorage.setItem(wsKey('border_repeat_img_url'), state.borderRepeatImgUrl || '');
    localStorage.setItem(wsKey('border_bottom_img_url'), state.borderBottomImgUrl || '');
    localStorage.setItem(wsKey('border_padding'), String(state.borderPadding || 40));
    localStorage.setItem(wsKey('colors'), JSON.stringify({
      colorPrimary: state.colorPrimary,
      colorSecondary: state.colorSecondary,
      colorAccent: state.colorAccent,
      bulletStyle: state.bulletStyle,
      titleStyle: state.titleStyle,
      iconNumber: state.iconNumber,
      iconBg: state.iconBg,
      titleSub: state.titleSub,
      thColor: state.thColor,
      thTextColor: state.thTextColor,
      subTitleTextColor: state.subTitleTextColor,
      subTitleLineColor: state.subTitleLineColor,
      subTitleBgColor: state.subTitleBgColor,
      subTitleShadowColor: state.subTitleShadowColor
    }));
    // UI 상태 저장 (채팅 펼침/접힘, 활성 뷰, 편집 모드)
    const aiBody = document.getElementById('ai-assistant-body');
    localStorage.setItem(wsKey('ui_state'), JSON.stringify({
      activeView: state.activeView || 'dual',
      editMode: state.editMode || false,
      chatExpanded: aiBody ? !aiBody.classList.contains('hidden') : true
    }));
    // 공고 타입 저장
    localStorage.setItem(wsKey('post_type'), JSON.stringify({
      isWorksPost: state.isWorksPost || false,
      isRasp: state.isRasp || false,
      isExternalPost: state.isExternalPost || false
    }));
  } catch (e) { console.warn('[Session] 저장 실패:', e.message); }
}

function restoreSession() {
  try {
    const saved = localStorage.getItem(wsKey('session_messages'));
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.messages = parsed.map(m => ({ ...m, timestamp: m.timestamp ? new Date(m.timestamp) : new Date() }));
      }
    }
    const html = localStorage.getItem(wsKey('session_convertedHtml'));
    if (html) state.convertedHtml = html;
    const src = localStorage.getItem(wsKey('session_sourceContent'));
    if (src) { state.sourceContent = src; if (elements.sourceEditor) safeSetHtml(elements.sourceEditor, src); }
    const kv = localStorage.getItem(wsKey('session_kv'));
    if (kv) Object.assign(state.kv, JSON.parse(kv));
    // 추가: 워크스페이스별 설정 복원
    const bb = localStorage.getItem(wsKey('bottom_buttons'));
    if (bb) { try { state.bottomButtons = JSON.parse(bb); } catch(e) {} }
    const jn = localStorage.getItem(wsKey('job_number'));
    if (jn !== null) state.jobNumber = jn;
    const jna = localStorage.getItem(wsKey('job_number_align'));
    if (jna) state.jobNumberAlign = jna;
    const jns = localStorage.getItem(wsKey('job_number_style'));
    if (jns) { try { Object.assign(state.jobNumberStyle, JSON.parse(jns)); } catch(e) {} }
    const hcn = localStorage.getItem(wsKey('header_company_name'));
    if (hcn !== null) state.headerCompanyName = hcn;
    const cna = localStorage.getItem(wsKey('company_name_align'));
    if (cna) state.companyNameAlign = cna;
    const cns = localStorage.getItem(wsKey('company_name_style'));
    if (cns) { try { Object.assign(state.companyNameStyle, JSON.parse(cns)); } catch(e) {} }
    const hd = localStorage.getItem(wsKey('header_date'));
    if (hd !== null) state.headerDate = hd;
    const hda = localStorage.getItem(wsKey('header_date_align'));
    if (hda) state.headerDateAlign = hda;
    const hds = localStorage.getItem(wsKey('header_date_style'));
    if (hds) { try { Object.assign(state.headerDateStyle, JSON.parse(hds)); } catch(e) {} }
    const tpl = localStorage.getItem(wsKey('template'));
    if (tpl) state.template = tpl;
    const brImg = localStorage.getItem(wsKey('border_repeat_img_url'));
    if (brImg !== null) state.borderRepeatImgUrl = brImg;
    const bbImg = localStorage.getItem(wsKey('border_bottom_img_url'));
    if (bbImg !== null) state.borderBottomImgUrl = bbImg;
    const bPad = localStorage.getItem(wsKey('border_padding'));
    if (bPad !== null) state.borderPadding = parseInt(bPad, 10) || 40;
    const colors = localStorage.getItem(wsKey('colors'));
    if (colors) {
      const c = JSON.parse(colors);
      if (c.colorPrimary) state.colorPrimary = c.colorPrimary;
      if (c.colorSecondary) state.colorSecondary = c.colorSecondary;
      if (c.colorAccent) state.colorAccent = c.colorAccent;
      if (c.bulletStyle) state.bulletStyle = c.bulletStyle;
      if (c.titleStyle) state.titleStyle = c.titleStyle;
      if (c.iconNumber) state.iconNumber = c.iconNumber;
      if (c.iconBg) state.iconBg = c.iconBg;
      if (c.titleSub) state.titleSub = c.titleSub;
      if (c.thColor) state.thColor = c.thColor;
      if (c.thTextColor) state.thTextColor = c.thTextColor;
      if (c.subTitleTextColor) state.subTitleTextColor = c.subTitleTextColor;
      if (c.subTitleLineColor) state.subTitleLineColor = c.subTitleLineColor;
      if (c.subTitleBgColor) state.subTitleBgColor = c.subTitleBgColor;
      if (c.subTitleShadowColor) state.subTitleShadowColor = c.subTitleShadowColor;
    }
    // originalSource 복원
    const os = localStorage.getItem(wsKey('original_source'));
    if (os) state.originalSource = JSON.parse(os);
    // UI 상태 복원
    const uiRaw = localStorage.getItem(wsKey('ui_state'));
    if (uiRaw) {
      const ui = JSON.parse(uiRaw);
      if (ui.activeView) state.activeView = ui.activeView;
      if (typeof ui.editMode === 'boolean') state.editMode = ui.editMode;
      if (typeof ui.chatExpanded === 'boolean') state._chatExpanded = ui.chatExpanded;
    }
    // 공고 타입 복원
    const ptRaw = localStorage.getItem(wsKey('post_type'));
    if (ptRaw) {
      const pt = JSON.parse(ptRaw);
      if (typeof pt.isWorksPost === 'boolean') state.isWorksPost = pt.isWorksPost;
      if (typeof pt.isRasp === 'boolean') state.isRasp = pt.isRasp;
      if (typeof pt.isExternalPost === 'boolean') state.isExternalPost = pt.isExternalPost;
      // 체크박스 UI 동기화
      const chkWorks = document.getElementById('chk-works-post');
      const chkRasp  = document.getElementById('chk-rasp');
      const chkExt   = document.getElementById('chk-external-post');
      if (chkWorks) chkWorks.checked = state.isWorksPost;
      if (chkRasp)  chkRasp.checked  = state.isRasp;
      if (chkExt)   chkExt.checked   = state.isExternalPost;
    }
  } catch (e) { console.warn('[Session] 복원 실패:', e.message); }
}

function clearSession() {
  ['session_messages', 'session_convertedHtml', 'session_sourceContent',
   'session_kv', 'original_source', 'job_number', 'template', 'colors', 'ui_state', 'post_type',
   'border_repeat_img_url', 'border_bottom_img_url', 'border_padding']
    .forEach(k => localStorage.removeItem(wsKey(k)));
}

// ============================================
// Background AI Result Saving (백그라운드 작업 결과 저장)
// ============================================

/**
 * 다른 워크스페이스에서 완료된 AI 작업 결과를 해당 워크스페이스의 localStorage에 직접 저장
 */
function saveBackgroundResult(wsId, convertedHtml, completionMsg) {
  try {
    // convertedHtml 저장
    localStorage.setItem(wsKeyFor(wsId, 'session_convertedHtml'), convertedHtml);
    localStorage.setItem(wsKeyFor(wsId, 'session_sourceContent'), convertedHtml);

    // 기존 메시지에 완료 메시지 추가
    const rawMsgs = localStorage.getItem(wsKeyFor(wsId, 'session_messages'));
    const msgs = rawMsgs ? JSON.parse(rawMsgs) : [];
    msgs.push({
      role: 'assistant',
      content: completionMsg,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(wsKeyFor(wsId, 'session_messages'), JSON.stringify(msgs));
  } catch (e) {
    console.warn('[BG] 백그라운드 결과 저장 실패:', e.message);
  }
}

/** 화면 하단에 일시적 토스트 알림 표시 */
function showToast(message, duration = 4000) {
  let container = document.getElementById('ws-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ws-toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText = 'padding:10px 16px;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--accent-color);border-radius:8px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.3);opacity:0;transition:opacity 0.3s;max-width:320px;';
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
// Workspace Switching (워크스페이스 전환)
// ============================================

const DEFAULT_KV = {
  presetKey: 'photoAnnounce01',
  jobCode: '공고 제2026-0호',
  title: '공고제목이 들어갑니다.',
  titleHtml: '공고제목이 들어갑니다.',
  orgName: '기업명이 들어갑니다.',
  orgNameHtml: '기업명이 들어갑니다.',
  description: '회사에 대한 소개가 들어갑니다.',
  description2: '',
  date: '2026년 2월 5일',
  companyName: '기업명',
  dateCompanyText: '2026년 2월 5일\n기업명',
  templateType: 'photoTop',
  splitLayout: 'text-left',
  textAlign: 'left',
  effect: 'none',
  heightMode: 'fluid',
  bgColor: '#F6F6F6',
  brandColor: '#F6F6F6',
  logoDataUrl: '',
  bgImageDataUrl: '',
  bgImageUrl: '',
  textShadow: 'none',
  titleAccentColor: '',
  photoContentBg: '#F6F6F6',
  photoJobCodeTop: 5,
  photoRadiusTL: 0, photoRadiusTR: 0, photoRadiusBL: 0, photoRadiusBR: 0,
  fieldStyles: {
    jobCode:     { fontSize: 11, color: '#ffffff', bold: false, fontFamily: 'Pretendard Variable', fontWeight: 400, align: 'inherit' },
    orgName:     { fontSize: 42, color: '#111111', bold: true,  fontFamily: 'Pretendard Variable', fontWeight: 700, align: 'inherit' },
    title:       { fontSize: 50, color: '#111111', bold: true,  fontFamily: 'Pretendard Variable', fontWeight: 700, align: 'inherit' },
    description: { fontSize: 20, color: '#121212', bold: false, fontFamily: 'Pretendard Variable', fontWeight: 400, align: 'inherit' },
    dateCompany: { fontSize: 42, color: '#111111', bold: true,  fontFamily: 'Pretendard Variable', fontWeight: 700, align: 'inherit' }
  },
  textPosition: {
    jobCode:     { left: 30, top: 20 },
    title:       { left: 30, top: 65 },
    description: { left: 30, top: 180 },
    dateCompany: { left: 30, top: 260 }
  }
};

function switchWorkspace(targetId) {
  if (targetId === getActiveId()) return;

  // 1. 현재 워크스페이스 저장
  saveSession();

  // 2. 활성 워크스페이스 변경
  setActiveId(targetId);

  // 3. per-workspace state 리셋
  // 주의: isLoading과 _aiAbortController는 리셋하지 않음
  // — 백그라운드 AI 작업이 계속 실행되어야 하므로
  state.messages = [];
  state.sourceContent = '';
  state.convertedHtml = '';
  state.originalSource = null;
  state.bottomButtons = [];
  state.jobNumber = '';
  state.headerCompanyName = '';
  state.headerDate = '';
  state.template = 'standard';
  state.colorPrimary = '#0066cc';
  state.colorSecondary = '#333333';
  state.colorAccent = '#ff6600';
  state.bulletStyle = 'chevron';
  state.titleStyle = 'iconBg';
  state.iconNumber = '1';
  state.iconBg = '1';
  state.titleSub = '1';
  state.thColor = '#f1f5f9';
  state.thTextColor = '#000000';
  state.subTitleTextColor = '#000000';
  state.subTitleLineColor = '#cbd1da';
  state.subTitleBgColor = '#e6f2ff';
  state.subTitleShadowColor = '#ff460a';
  state.editMode = false;
  state.activeView = 'dual';
  state._chatExpanded = true;
  state.lastContinuations = 0;
  state.kv = JSON.parse(JSON.stringify(DEFAULT_KV));

  // 4. 새 워크스페이스 데이터 로드
  restoreSession();

  // 5. UI 전체 갱신
  syncWorkspaceUI();
  renderWorkspaceDropdown();
}

/** 워크스페이스 전환 시 모든 UI 동기화 */
function syncWorkspaceUI() {
  // 전송 버튼 상태: 현재 워크스페이스가 로딩 중이 아니면 기본 상태로 복원
  const sendBtn = document.getElementById('ai-chat-send');
  const chatInput = document.getElementById('ai-chat-input');
  if (chatInput) { chatInput.value = ''; chatInput.dispatchEvent(new Event('input')); }
  if (sendBtn && (!state.isLoading || state._loadingWsId !== getActiveId())) {
    sendBtn.classList.remove('loading');
    sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg>';
    sendBtn.title = '전송';
    sendBtn.disabled = true;
  }

  // 변환 버튼 상태: 현재 워크스페이스가 로딩 중이 아니면 활성화
  if (elements.btnConvert && (!state.isLoading || state._loadingWsId !== getActiveId())) {
    elements.btnConvert.disabled = false;
    elements.btnConvert.textContent = 'AI 변환 시작';
    setConvertingTabState(false);
  }

  // 메시지
  renderMessages();
  if (typeof renderSharedAiMessages === 'function') renderSharedAiMessages();

  // 에디터 영역
  if (elements.sourceEditor) {
    elements.sourceEditor.innerHTML = state.sourceContent || '';
  }

  // 원문 영역
  populateOriginalViewer();

  // 미리보기 & 코드
  if (state.convertedHtml) {
    updatePreview();
    updateHtmlCode();
  } else {
    if (elements.previewContent) elements.previewContent.innerHTML = '';
    if (elements.htmlCode) elements.htmlCode.value = '';
    updateLivePreview();
  }

  // 하단 버튼 목록 UI 동기화
  renderBottomBtnList();

  // 설정 패널 동기화
  if (elements.jobNumber) elements.jobNumber.value = state.jobNumber || '';
  document.querySelectorAll('.job-num-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === (state.jobNumberAlign || 'left')));
  // 채용공고 번호 스타일 컨트롤 동기화
  document.querySelectorAll('.job-num-settings [data-jn-prop="fontSize"]').forEach(el => el.value = state.jobNumberStyle.fontSize);
  document.querySelectorAll('.job-num-settings input[type="color"][data-jn-prop="color"]').forEach(el => el.value = state.jobNumberStyle.color);
  document.querySelectorAll('.job-num-settings .kv-hex-input[data-jn-prop="color"]').forEach(el => el.value = state.jobNumberStyle.color.toUpperCase());
  document.querySelectorAll('.job-num-settings input[type="checkbox"][data-jn-prop="bold"]').forEach(el => el.checked = state.jobNumberStyle.bold);
  document.querySelectorAll('.job-num-settings [data-jn-prop="top"]').forEach(el => el.value = state.jobNumberStyle.top ?? 10);
  // 기업명 스타일 컨트롤 동기화
  if (elements.headerCompanyName) elements.headerCompanyName.value = state.headerCompanyName || '';
  document.querySelectorAll('.company-name-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === (state.companyNameAlign || 'left')));
  document.querySelectorAll('.company-name-settings [data-cn-prop="fontSize"]').forEach(el => el.value = state.companyNameStyle.fontSize);
  document.querySelectorAll('.company-name-settings input[type="color"][data-cn-prop="color"]').forEach(el => el.value = state.companyNameStyle.color);
  document.querySelectorAll('.company-name-settings .kv-hex-input[data-cn-prop="color"]').forEach(el => el.value = state.companyNameStyle.color.toUpperCase());
  document.querySelectorAll('.company-name-settings input[type="checkbox"][data-cn-prop="bold"]').forEach(el => el.checked = state.companyNameStyle.bold);
  document.querySelectorAll('.company-name-settings [data-cn-prop="top"]').forEach(el => el.value = state.companyNameStyle.top ?? 5);
  // 날짜 스타일 컨트롤 동기화
  if (elements.headerDate) elements.headerDate.value = state.headerDate || '';
  document.querySelectorAll('.header-date-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === (state.headerDateAlign || 'left')));
  document.querySelectorAll('.header-date-settings [data-dt-prop="fontSize"]').forEach(el => el.value = state.headerDateStyle.fontSize);
  document.querySelectorAll('.header-date-settings input[type="color"][data-dt-prop="color"]').forEach(el => el.value = state.headerDateStyle.color);
  document.querySelectorAll('.header-date-settings .kv-hex-input[data-dt-prop="color"]').forEach(el => el.value = state.headerDateStyle.color.toUpperCase());
  document.querySelectorAll('.header-date-settings input[type="checkbox"][data-dt-prop="bold"]').forEach(el => el.checked = state.headerDateStyle.bold);
  document.querySelectorAll('.header-date-settings [data-dt-prop="top"]').forEach(el => el.value = state.headerDateStyle.top ?? 5);
  document.getElementById('color-primary').value = state.colorPrimary;
  document.getElementById('color-primary-hex').value = state.colorPrimary.toUpperCase();
  document.getElementById('color-secondary').value = state.colorSecondary;
  document.getElementById('color-secondary-hex').value = state.colorSecondary.toUpperCase();
  document.getElementById('color-accent').value = state.colorAccent;
  document.getElementById('color-accent-hex').value = state.colorAccent.toUpperCase();

  // 불릿 스타일
  elements.bulletBtns?.forEach(b => b.classList.remove('active'));
  const activeBullet = document.querySelector(`[data-bullet="${state.bulletStyle}"]`);
  if (activeBullet) activeBullet.classList.add('active');

  // 템플릿 카드
  document.querySelectorAll('.wf-template-card').forEach(c => c.classList.remove('active'));
  const tplCard = document.querySelector(`[data-template="${state.template}"]`);
  if (tplCard) tplCard.classList.add('active');
  if (elements.templateName) elements.templateName.textContent = templates[state.template]?.name || 'Standard';

  // 보더 이미지 입력 그룹 표시/숨김 + 값 복원
  const borderImagesGroup = document.getElementById('border-images-group');
  if (borderImagesGroup) borderImagesGroup.style.display = state.template === 'standard_border' ? 'block' : 'none';
  const borderRepeatInput = document.getElementById('border-repeat-img-url');
  const borderBottomInput = document.getElementById('border-bottom-img-url');
  if (borderRepeatInput) borderRepeatInput.value = state.borderRepeatImgUrl || '';
  if (borderBottomInput) borderBottomInput.value = state.borderBottomImgUrl || '';
  const borderPadRange = document.getElementById('border-padding-range');
  const borderPadValue = document.getElementById('border-padding-value');
  if (borderPadRange) borderPadRange.value = state.borderPadding || 40;
  if (borderPadValue) borderPadValue.value = state.borderPadding || 40;

  // 타이틀 스타일 동기화
  const titleStyleEl = document.getElementById('title-style');
  if (titleStyleEl) titleStyleEl.value = state.titleStyle;
  renderTitleStyleOptions();

  // 테이블 헤더 색상 동기화
  const thColorEl = document.getElementById('th-color');
  const thColorHex = document.getElementById('th-color-hex');
  if (thColorEl) thColorEl.value = state.thColor;
  if (thColorHex) thColorHex.value = state.thColor.toUpperCase();
  const thTextEl = document.getElementById('th-text-color');
  const thTextHex = document.getElementById('th-text-color-hex');
  if (thTextEl) thTextEl.value = state.thTextColor;
  if (thTextHex) thTextHex.value = state.thTextColor.toUpperCase();

  // CSS 변수
  updateCssVariables();

  // KV 초기화 반영
  const wsPresetKey = state.kv.presetKey || 'photoAnnounce01';
  applyKvPreset(wsPresetKey);
  document.querySelectorAll('.kv-preset-card').forEach(b => b.classList.toggle('active', b.dataset.preset === wsPresetKey));
  updateKvControls();
  renderKvPreview();

  // 채팅 펼침/접힘 복원
  const aiBody = document.getElementById('ai-assistant-body');
  const aiHeader = document.getElementById('ai-assistant-toggle');
  if (aiBody && aiHeader) {
    const expanded = state._chatExpanded !== undefined ? state._chatExpanded : true;
    if (expanded) {
      aiBody.classList.remove('hidden');
      aiHeader.classList.add('open');
    } else {
      aiBody.classList.add('hidden');
      aiHeader.classList.remove('open');
    }
  }

  // 활성 뷰 탭 복원
  if (state.activeView) {
    elements.viewBtns?.forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-view="${state.activeView}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    setView(state.activeView);
  }
}

/** 드롭다운 메뉴 렌더링 */
function renderWorkspaceDropdown() {
  const label = document.getElementById('ws-dropdown-label');
  const menu = document.getElementById('ws-dropdown-menu');
  if (!label || !menu) return;

  const registry = getRegistry();
  const activeId = getActiveId();
  const active = registry.find(w => w.id === activeId);

  // 버튼 라벨 업데이트
  label.textContent = active ? active.name : '작업 1';

  // 메뉴 아이템 생성
  let html = '';
  registry.forEach(ws => {
    const isActive = ws.id === activeId;
    const canDelete = registry.length > 1;
    html += `<div class="ws-menu-item${isActive ? ' active' : ''}" data-ws-id="${ws.id}">
      <span class="ws-menu-item-name">${escapeHtml(ws.name)}</span>
      ${canDelete ? `<button class="ws-delete-btn" data-ws-delete="${ws.id}" title="삭제">✕</button>` : ''}
    </div>`;
  });

  html += '<div class="ws-menu-divider"></div>';

  if (registry.length < getMaxWorkspaces()) {
    html += `<div class="ws-menu-action" id="ws-new-btn">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="7" y1="2" x2="7" y2="12"/><line x1="2" y1="7" x2="12" y2="7"/>
      </svg>
      <span>새 작업</span>
    </div>`;
  } else {
    html += `<div class="ws-menu-action" style="opacity:0.5;cursor:default;">
      <span>최대 ${getMaxWorkspaces()}개까지 가능</span>
    </div>`;
  }

  menu.innerHTML = html;
}

/** 드롭다운 이벤트 설정 */
function setupWorkspaceDropdown() {
  const btn = document.getElementById('ws-dropdown-btn');
  const menu = document.getElementById('ws-dropdown-menu');
  if (!btn || !menu) return;

  // 토글
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  // 메뉴 아이템 클릭 (이벤트 위임)
  menu.addEventListener('click', (e) => {
    // 삭제 버튼
    const delBtn = e.target.closest('[data-ws-delete]');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.wsDelete;
      const ws = getRegistry().find(w => w.id === id);
      if (ws && confirm(`"${ws.name}" 작업을 삭제하시겠습니까?`)) {
        const wasActive = id === getActiveId();
        deleteWorkspace(id);
        if (wasActive) {
          // 다른 워크스페이스로 전환
          switchWorkspace(getRegistry()[0].id);
        } else {
          renderWorkspaceDropdown();
        }
      }
      return;
    }

    // 새 작업 — 편집 모드 비활성화 + 새 워크스페이스 생성 + 페이지 리로드로 완전 초기화
    if (e.target.closest('#ws-new-btn')) {
      // 편집 모드 강제 off
      if (state.editMode) {
        const editToggle = document.getElementById('edit-mode-toggle');
        if (editToggle) editToggle.checked = false;
        state.editMode = false;
        if (typeof toggleEditMode === 'function') toggleEditMode(false);
      }
      // 현재 워크스페이스 저장 (필요 시 나중에 복원 가능)
      if (typeof saveSession === 'function') saveSession();

      const newId = createWorkspace();
      const doReset = (targetId) => {
        // 1) beforeunload가 현재 state(기존 내용)를 저장하지 않도록 state를 비움
        state.messages = [];
        state.convertedHtml = '';
        state.sourceContent = '';
        state.originalSource = null;
        state.jobNumber = '';
        state.headerCompanyName = '';
        state.headerDate = '';
        state.bottomButtons = [];
        state.editMode = false;

        // 2) beforeunload 이벤트 리스너 제거 (saveSession 실행 차단)
        if (typeof saveSession === 'function') {
          window.removeEventListener('beforeunload', saveSession);
        }

        // 3) 대상 워크스페이스의 모든 session_* 키 명시적 삭제
        if (targetId) {
          try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith(`${targetId}/`)) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
          } catch (err) { console.warn('워크스페이스 초기화 실패', err); }
        }
        menu.classList.add('hidden');

        // 4) cache-busting 쿼리로 하드 리로드
        const url = new URL(location.href);
        url.searchParams.set('_ws_reset', Date.now().toString());
        location.href = url.toString();
      };

      if (newId) {
        // 새 워크스페이스 활성화 + state 비우기 + 세션 키 삭제 후 리로드
        if (typeof setActiveId === 'function') setActiveId(newId);
        doReset(newId);
      } else {
        // 최대 개수 도달 — 현재 워크스페이스를 초기화
        const proceed = confirm('작업 최대 개수(10개)에 도달했습니다.\n현재 작업을 초기화하시겠습니까?\n\n(기존 입력/변환 결과가 모두 삭제됩니다)');
        if (proceed) {
          const activeId = (typeof getActiveId === 'function') ? getActiveId() : null;
          doReset(activeId);
        }
      }
      return;
    }

    // 워크스페이스 선택
    const item = e.target.closest('[data-ws-id]');
    if (item) {
      switchWorkspace(item.dataset.wsId);
      menu.classList.add('hidden');
    }
  });

  // 메뉴 아이템 더블클릭 → 이름 변경
  menu.addEventListener('dblclick', (e) => {
    const item = e.target.closest('[data-ws-id]');
    if (!item) return;
    const id = item.dataset.wsId;
    const ws = getRegistry().find(w => w.id === id);
    if (!ws) return;

    const nameSpan = item.querySelector('.ws-menu-item-name');
    if (!nameSpan) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = ws.name;
    input.className = 'ws-rename-input';
    input.style.cssText = 'width:100%;padding:2px 4px;font-size:13px;border:1px solid var(--accent-color);border-radius:4px;background:var(--bg-primary);color:var(--text-primary);';
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    const finishRename = () => {
      const newName = input.value.trim() || ws.name;
      renameWorkspace(id, newName);
      renderWorkspaceDropdown();
    };
    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { input.value = ws.name; input.blur(); }
    });
  });

  // 외부 클릭 시 닫기
  document.addEventListener('click', () => menu.classList.add('hidden'));
}

/** 워크스페이스 자동 이름 설정 (기본 이름인 경우만) */
function autoRenameCurrentWorkspace(name, force = false) {
  if (!name) return;
  const activeId = getActiveId();
  const ws = getRegistry().find(w => w.id === activeId);
  if (!ws) return;
  // force=true: 파일명→제목 업그레이드 등 기존 이름 덮어쓰기
  // force=false: "작업 N" 패턴인 경우만 자동 변경
  if (!force && !/^작업 \d+$/.test(ws.name)) return;
  // 파일 확장자 제거
  let clean = name.replace(/\.(hwp|hwpx|docx?|xlsx?|pdf|txt|csv|rtf|html?)$/i, '');
  // 이름을 적당히 자르기 (최대 30자)
  const trimmed = clean.length > 30 ? clean.slice(0, 30) + '…' : clean;
  renameWorkspace(activeId, trimmed);
  renderWorkspaceDropdown();
}

// ============================================
// Initialization
// ============================================
function init() {
  initWorkspaces();  // 워크스페이스 초기화 (마이그레이션 포함)
  setupEventListeners();
  loadSettings();
  restoreSession();
  updateAiStatus();
  setupResizeHandles();
  try { setupKeyVisual(); } catch (e) { console.error('setupKeyVisual error:', e); }
  initSourceTabs();
  try { setupWorkflow(); } catch (e) { console.error('setupWorkflow error:', e); }
  try { setupSharedAiAssistant(); } catch (e) { console.error('setupSharedAiAssistant error:', e); }

  // 워크스페이스 드롭다운 초기화
  setupWorkspaceDropdown();
  renderWorkspaceDropdown();

  // isLoading 안전 리셋 (페이지 로드 시 항상 false)
  state.isLoading = false;

  // 아이콘 시스템 초기화 (Lucide Icons)
  try {
    initIcons();
    console.log('[Icons] Lucide Icons 초기화 완료');
  } catch (e) {
    console.error('[Icons] 초기화 실패:', e);
  }

  // 변환 서버(convert-server) 가용성 체크 (비동기, UI 블로킹 없음)
  (async () => {
    try {
      const h = await fetch(CONVERT_HEALTH_URL, { signal: AbortSignal.timeout(2000) });
      if (h.ok) {
        const info = await h.json();
        state.convertServerAvailable = true;
        state.convertServerInfo = info;
        console.log('[ConvertServer] 연결됨:', info.libreoffice ? 'LibreOffice 사용 가능' : 'LibreOffice 없음');
      } else {
        state.convertServerAvailable = false;
      }
    } catch {
      state.convertServerAvailable = false;
    }
  })();

  // 세션 복원 후 UI 갱신
  if (state.messages.length > 0) renderMessages();
  if (state.convertedHtml) { updatePreview(); updateHtmlCode(); }

  // 원문 뷰어 갱신
  populateOriginalViewer();

  // 페이지 떠나기 전 세션 저장
  window.addEventListener('beforeunload', saveSession);

  // 크레딧 모달 (버전 클릭 이스터에그)
  setupCreditsModal();

  // HTML 코드 입력 기능
  setupHtmlCodeInput();

  // 버전·빌드 번호 반영
  const versionStr = `v${APP_VERSION}`;
  const buildStr = `build ${APP_BUILD}`;
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.innerHTML = `인크루트 채용공고 에디터 <span class="text-gray-500">${versionStr}</span> <span class="text-gray-600 text-[10px]">${buildStr}</span>`;
    versionEl.title = `${versionStr} ${buildStr} (${APP_BUILD_DATE})`;
  }
  const creditsVersion = document.querySelector('.credits-version');
  if (creditsVersion) creditsVersion.textContent = `${versionStr} ${buildStr}`;

  console.log(`Incruit Jobpost Editor ${versionStr} ${buildStr} initialized`);
}

// ============================================
// Credits Modal (Easter Egg)
// ============================================
function setupCreditsModal() {
  const versionEl = document.getElementById('app-version');
  const modal = document.getElementById('credits-modal');
  if (!versionEl || !modal) return;

  const backdrop = modal.querySelector('.credits-backdrop');
  const closeBtn = modal.querySelector('.credits-close');

  versionEl.addEventListener('click', () => {
    // 통계 실시간 갱신
    const statsEl = document.getElementById('credits-stats');
    if (statsEl) {
      const c = getCumulativeStats();
      const workerName = localStorage.getItem('worker_name');
      const greeting = workerName ? `${workerName}님과 함께한 여정` : '지금까지의 여정';
      const parent = statsEl.closest('.credits-stats-section');
      if (parent) {
        const h3 = parent.querySelector('h3');
        if (h3) h3.textContent = greeting;
      }

      if (c.totalJobs > 0) {
        statsEl.innerHTML = `
          <div class="credits-stat">
            <div class="credits-stat-value">${c.totalJobs.toLocaleString()}</div>
            <div class="credits-stat-label">채용공고 처리</div>
          </div>
          <div class="credits-stat">
            <div class="credits-stat-value">${formatChars(c.totalCharsProcessed)}</div>
            <div class="credits-stat-label">원문 처리량</div>
          </div>
          <div class="credits-stat">
            <div class="credits-stat-value">${c.aRate}%</div>
            <div class="credits-stat-label">A등급 비율</div>
          </div>
          <div class="credits-stat">
            <div class="credits-stat-value">${c.daysSince}일</div>
            <div class="credits-stat-label">함께한 날</div>
          </div>
          <div class="credits-stat full-width">
            <div class="credits-stat-value">${c.totalTimeFormatted}</div>
            <div class="credits-stat-label">총 작업 시간</div>
          </div>`;
      } else {
        statsEl.innerHTML = `<div class="credits-stat full-width">
          <div class="credits-stat-value">0</div>
          <div class="credits-stat-label">아직 첫 공고를 기다리는 중...</div>
        </div>`;
      }
    }
    modal.hidden = false;
  });

  const closeModal = () => { modal.hidden = true; };
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function resetAll() {
  if (!confirm('모든 내용을 초기화하시겠습니까?\n(API 키 설정은 유지됩니다)')) return;

  // 원문/변환문 초기화
  state.sourceContent = '';
  state.convertedHtml = '';
  state.originalSource = null;
  localStorage.removeItem(wsKey('original_source'));

  // 설정 초기화
  state.jobNumber = '';
  state.headerCompanyName = '';
  state.headerDate = '';
  state.template = 'standard';
  state.keyVisualUrl = '';
  state.borderRepeatImgUrl = '';
  state.borderBottomImgUrl = '';
  state.borderPadding = 40;
  state.colorPrimary = '#0066cc';
  state.colorSecondary = '#333333';
  state.colorAccent = '#ff6600';
  state.bulletStyle = 'chevron';
  state.titleStyle = 'iconBg';
  state.iconNumber = '1';
  state.iconBg = '1';
  state.titleSub = '1';
  state.thColor = '#f1f5f9';
  state.thTextColor = '#000000';
  state.subTitleTextColor = '#000000';
  state.subTitleLineColor = '#cbd1da';
  state.subTitleBgColor = '#e6f2ff';
  state.subTitleShadowColor = '#ff460a';

  // 채팅 초기화
  state.messages = [];
  state.isLoading = false;

  // 세션 데이터 초기화
  clearSession();

  // KV 초기화
  state.kv = {
    jobCode: '공고 제2026-0호',
    title: '기업명이 들어갑니다.\n공고명이 들어갑니다.\n최대 3줄까지 가능합니다.',
    description: '회사에 대한 소개가 들어갑니다.\n회사에 대한 소개가 들어갑니다.\n최대 3줄까지 가능합니다.',
    date: '2026년 2월 5일',
    companyName: '기업명',
    templateType: 'overlay',
    splitLayout: 'text-left',
    textAlign: 'left',
    effect: 'gradient',
    heightMode: 'fixed',
    bgColor: '#1f46a8',
    brandColor: '#16213d',
    logoDataUrl: '',
    bgImageDataUrl: '',
    bgImageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    fieldStyles: {
      jobCode:     { fontSize: 14, color: '#FFFFFF', bold: false },
      title:       { fontSize: 50, color: '#FFFFFF', bold: true },
      description: { fontSize: 13, color: '#FFFFFF', bold: false },
      dateCompany: { fontSize: 12, color: '#FFFFFF', bold: false }
    },
    textPosition: {
      jobCode:     { left: 30, top: 20 },
      title:       { left: 30, top: 65 },
      description: { left: 30, top: 180 },
      dateCompany: { left: 30, top: 260 }
    }
  };

  // UI 초기화
  if (elements.jobNumber) elements.jobNumber.value = '';
  if (elements.headerCompanyName) elements.headerCompanyName.value = '';
  if (elements.headerDate) elements.headerDate.value = '';
  if (elements.templateSelect) elements.templateSelect.value = 'standard';
  if (elements.keyVisualUrl) elements.keyVisualUrl.value = '';
  if (elements.keyVisualPreview) elements.keyVisualPreview.classList.add('hidden');
  const borderRepeatInput = document.getElementById('border-repeat-img-url');
  const borderBottomInput = document.getElementById('border-bottom-img-url');
  if (borderRepeatInput) borderRepeatInput.value = '';
  if (borderBottomInput) borderBottomInput.value = '';
  const borderPadRange = document.getElementById('border-padding-range');
  const borderPadValue = document.getElementById('border-padding-value');
  if (borderPadRange) borderPadRange.value = 40;
  if (borderPadValue) borderPadValue.value = 40;
  const borderImagesGroup = document.getElementById('border-images-group');
  if (borderImagesGroup) borderImagesGroup.style.display = 'none';
  if (elements.sourceEditor) elements.sourceEditor.innerHTML = '';

  // 원문 영역 초기화
  const originalViewer = document.getElementById('original-viewer');
  if (originalViewer) originalViewer.innerHTML = '';
  const originalLabel = document.getElementById('original-source-label');
  if (originalLabel) originalLabel.textContent = '';

  // 컬러 초기화
  document.getElementById('color-primary').value = '#0066cc';
  document.getElementById('color-primary-hex').value = '#0066CC';
  document.getElementById('color-secondary').value = '#333333';
  document.getElementById('color-secondary-hex').value = '#333333';
  document.getElementById('color-accent').value = '#ff6600';
  document.getElementById('color-accent-hex').value = '#FF6600';

  // 불릿 초기화
  elements.bulletBtns.forEach(b => b.classList.remove('active'));
  const defaultBulletBtn = document.querySelector('[data-bullet="chevron"]');
  if (defaultBulletBtn) defaultBulletBtn.classList.add('active');

  // 템플릿 카드 초기화
  document.querySelectorAll('.wf-template-card').forEach(c => c.classList.remove('active'));
  const stdCard = document.querySelector('[data-template="standard"]');
  if (stdCard) stdCard.classList.add('active');
  if (elements.templateName) elements.templateName.textContent = templates['standard']?.name || 'Standard';

  // 파일 첨부 칩 초기화
  const fileChip = document.getElementById('ai-file-chip');
  if (fileChip) fileChip.classList.add('hidden');

  // CSS 변수 & 미리보기 갱신
  updateCssVariables();
  updateLivePreview();
  updatePreview();
  renderSharedAiMessages();
  updateWfSummary();

  console.log('전체 초기화 완료');
}

function initSourceTabs() {
  // 저장된 원본이 있고 sourceEditor가 비어있으면 원본 로드
  if (state.originalSource && !elements.sourceEditor.innerHTML.trim()) {
    elements.sourceEditor.innerHTML = state.originalSource.raw;
    state.sourceContent = state.originalSource.raw;
    updateLivePreview();
  }
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Settings
  elements.jobNumber.addEventListener('input', (e) => {
    state.jobNumber = e.target.value;
    refreshJobNumberInPreview();
    updateHtmlCode();
  });

  // 채용공고 번호 설정 토글
  document.querySelector('.job-num-settings-toggle')?.addEventListener('click', (e) => {
    const panel = e.target.closest('.setting-group').querySelector('.job-num-settings');
    const isHidden = panel.classList.toggle('hidden');
    e.target.textContent = isHidden ? '설정 ▼' : '설정 ▲';
  });

  // 기업명 입력
  elements.headerCompanyName?.addEventListener('input', (e) => {
    state.headerCompanyName = e.target.value;
    refreshJobNumberInPreview();
    updateHtmlCode();
  });

  // 기업명 설정 토글
  document.querySelector('.company-name-settings-toggle')?.addEventListener('click', (e) => {
    const panel = e.target.closest('.setting-group').querySelector('.company-name-settings');
    const isHidden = panel.classList.toggle('hidden');
    e.target.textContent = isHidden ? '설정 ▼' : '설정 ▲';
  });

  // 기업명 슬라이더 ↔ 숫자 동기화
  document.querySelectorAll('.company-name-settings .kv-slider[data-cn-prop]').forEach(slider => {
    slider.addEventListener('input', () => {
      const prop = slider.dataset.cnProp;
      const numInput = slider.parentElement.querySelector('.kv-value-input[data-cn-prop]');
      if (numInput) numInput.value = slider.value;
      state.companyNameStyle[prop] = Number(slider.value);
      updatePreview();
    });
  });
  document.querySelectorAll('.company-name-settings .kv-value-input[data-cn-prop]').forEach(numInput => {
    numInput.addEventListener('input', () => {
      const prop = numInput.dataset.cnProp;
      const slider = numInput.parentElement.querySelector('.kv-slider[data-cn-prop]');
      if (slider) slider.value = numInput.value;
      state.companyNameStyle[prop] = Number(numInput.value);
      updatePreview();
    });
  });
  document.querySelectorAll('.company-name-settings input[type="color"][data-cn-prop]').forEach(picker => {
    picker.addEventListener('input', () => {
      const hexInput = picker.parentElement.querySelector('.kv-hex-input[data-cn-prop]');
      if (hexInput) hexInput.value = picker.value.toUpperCase();
      state.companyNameStyle.color = picker.value.toUpperCase();
      updatePreview();
    });
  });
  document.querySelectorAll('.company-name-settings .kv-hex-input[data-cn-prop]').forEach(hexInput => {
    hexInput.addEventListener('input', () => {
      const v = hexInput.value;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        const picker = hexInput.parentElement.querySelector('input[type="color"][data-cn-prop]');
        if (picker) picker.value = v;
        state.companyNameStyle.color = v.toUpperCase();
        updatePreview();
      }
    });
  });
  document.querySelectorAll('.company-name-settings input[type="checkbox"][data-cn-prop]').forEach(cb => {
    cb.addEventListener('change', () => {
      state.companyNameStyle.bold = cb.checked;
      updatePreview();
    });
  });
  document.querySelectorAll('.company-name-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.companyNameAlign = btn.dataset.align;
      document.querySelectorAll('.company-name-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === state.companyNameAlign));
      updatePreview();
    });
  });

  // 날짜 입력
  elements.headerDate?.addEventListener('input', (e) => {
    state.headerDate = e.target.value;
    refreshJobNumberInPreview();
    updateHtmlCode();
  });

  // 날짜 설정 토글
  document.querySelector('.header-date-settings-toggle')?.addEventListener('click', (e) => {
    const panel = e.target.closest('.setting-group').querySelector('.header-date-settings');
    const isHidden = panel.classList.toggle('hidden');
    e.target.textContent = isHidden ? '설정 ▼' : '설정 ▲';
  });

  // 날짜 슬라이더 ↔ 숫자 동기화
  document.querySelectorAll('.header-date-settings .kv-slider[data-dt-prop]').forEach(slider => {
    slider.addEventListener('input', () => {
      const prop = slider.dataset.dtProp;
      const numInput = slider.parentElement.querySelector('.kv-value-input[data-dt-prop]');
      if (numInput) numInput.value = slider.value;
      state.headerDateStyle[prop] = Number(slider.value);
      updatePreview();
    });
  });
  document.querySelectorAll('.header-date-settings .kv-value-input[data-dt-prop]').forEach(numInput => {
    numInput.addEventListener('input', () => {
      const prop = numInput.dataset.dtProp;
      const slider = numInput.parentElement.querySelector('.kv-slider[data-dt-prop]');
      if (slider) slider.value = numInput.value;
      state.headerDateStyle[prop] = Number(numInput.value);
      updatePreview();
    });
  });
  document.querySelectorAll('.header-date-settings input[type="color"][data-dt-prop]').forEach(picker => {
    picker.addEventListener('input', () => {
      const hexInput = picker.parentElement.querySelector('.kv-hex-input[data-dt-prop]');
      if (hexInput) hexInput.value = picker.value.toUpperCase();
      state.headerDateStyle.color = picker.value.toUpperCase();
      updatePreview();
    });
  });
  document.querySelectorAll('.header-date-settings .kv-hex-input[data-dt-prop]').forEach(hexInput => {
    hexInput.addEventListener('input', () => {
      const v = hexInput.value;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        const picker = hexInput.parentElement.querySelector('input[type="color"][data-dt-prop]');
        if (picker) picker.value = v;
        state.headerDateStyle.color = v.toUpperCase();
        updatePreview();
      }
    });
  });
  document.querySelectorAll('.header-date-settings input[type="checkbox"][data-dt-prop]').forEach(cb => {
    cb.addEventListener('change', () => {
      state.headerDateStyle.bold = cb.checked;
      updatePreview();
    });
  });
  document.querySelectorAll('.header-date-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.headerDateAlign = btn.dataset.align;
      document.querySelectorAll('.header-date-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === state.headerDateAlign));
      updatePreview();
    });
  });

  // 채용공고 번호 폰트 크기 슬라이더 ↔ 숫자 동기화
  document.querySelectorAll('.job-num-settings .kv-slider[data-jn-prop]').forEach(slider => {
    slider.addEventListener('input', () => {
      const prop = slider.dataset.jnProp;
      const numInput = slider.parentElement.querySelector('.kv-value-input[data-jn-prop]');
      if (numInput) numInput.value = slider.value;
      state.jobNumberStyle[prop] = Number(slider.value);
      updatePreview();
    });
  });

  document.querySelectorAll('.job-num-settings .kv-value-input[data-jn-prop]').forEach(numInput => {
    numInput.addEventListener('input', () => {
      const prop = numInput.dataset.jnProp;
      const slider = numInput.parentElement.querySelector('.kv-slider[data-jn-prop]');
      if (slider) slider.value = numInput.value;
      state.jobNumberStyle[prop] = Number(numInput.value);
      updatePreview();
    });
  });

  // 채용공고 번호 색상
  document.querySelectorAll('.job-num-settings input[type="color"][data-jn-prop]').forEach(picker => {
    picker.addEventListener('input', () => {
      const hexInput = picker.parentElement.querySelector('.kv-hex-input[data-jn-prop]');
      if (hexInput) hexInput.value = picker.value.toUpperCase();
      state.jobNumberStyle.color = picker.value.toUpperCase();
      updatePreview();
    });
  });

  document.querySelectorAll('.job-num-settings .kv-hex-input[data-jn-prop]').forEach(hexInput => {
    hexInput.addEventListener('input', () => {
      const v = hexInput.value;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        const picker = hexInput.parentElement.querySelector('input[type="color"][data-jn-prop]');
        if (picker) picker.value = v;
        state.jobNumberStyle.color = v.toUpperCase();
        updatePreview();
      }
    });
  });

  // 채용공고 번호 굵기
  document.querySelectorAll('.job-num-settings input[type="checkbox"][data-jn-prop]').forEach(cb => {
    cb.addEventListener('change', () => {
      state.jobNumberStyle.bold = cb.checked;
      updatePreview();
    });
  });

  // 채용공고 번호 정렬 버튼
  document.querySelectorAll('.job-num-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.jobNumberAlign = btn.dataset.align;
      document.querySelectorAll('.job-num-align-btn').forEach(b => b.classList.toggle('active', b.dataset.align === state.jobNumberAlign));
      updatePreview();
    });
  });

  // ---- 하단 버튼 추가 ----
  document.getElementById('bottom-btn-add')?.addEventListener('click', () => {
    if (!state.bottomButtons) state.bottomButtons = [];
    state.bottomButtons.push({ text: '지원하기', href: '', bgColor: '#FF460A', textColor: '#FFFFFF', styleClass: 'temp_btn btn' });
    renderBottomBtnList();
    refreshBottomButtonsInPreview();
    updateHtmlCode();
    saveSession();
  });

  elements.templateSelect.addEventListener('change', (e) => {
    state.template = e.target.value;
    elements.templateName.textContent = templates[state.template].name;
    const borderImagesGroup = document.getElementById('border-images-group');
    if (borderImagesGroup) borderImagesGroup.style.display = state.template === 'standard_border' ? 'block' : 'none';
    updatePreview();
  });

  elements.keyVisualUrl.addEventListener('input', (e) => {
    state.keyVisualUrl = e.target.value;
    updateKeyVisualPreview();
    updatePreview();
    syncKvVisibility();
    syncNonKvFieldsVisibility();
  });

  // 보더 이미지 URL 입력 리스너
  const borderRepeatInput = document.getElementById('border-repeat-img-url');
  if (borderRepeatInput) {
    borderRepeatInput.addEventListener('input', (e) => {
      state.borderRepeatImgUrl = e.target.value;
      updatePreview();
    });
  }
  const borderBottomInput = document.getElementById('border-bottom-img-url');
  if (borderBottomInput) {
    borderBottomInput.addEventListener('input', (e) => {
      state.borderBottomImgUrl = e.target.value;
      updatePreview();
    });
  }
  // 보더 좌우 여백 슬라이더/숫자 입력 리스너
  const borderPadRangeEl = document.getElementById('border-padding-range');
  const borderPadValueEl = document.getElementById('border-padding-value');
  if (borderPadRangeEl && borderPadValueEl) {
    borderPadRangeEl.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      state.borderPadding = v;
      borderPadValueEl.value = v;
      updatePreview();
    });
    borderPadValueEl.addEventListener('input', (e) => {
      let v = parseInt(e.target.value, 10);
      if (isNaN(v)) v = 40;
      v = Math.max(40, Math.min(60, v));
      state.borderPadding = v;
      borderPadRangeEl.value = v;
      updatePreview();
    });
  }

  // 컬러 팔레트: 스워치 ↔ hex 양방향 동기화
  function setupColorPair(swatchId, hexId, stateKey, alsoUpdatePreview) {
    const swatch = document.getElementById(swatchId);
    const hex = document.getElementById(hexId);
    if (!swatch || !hex) return;

    // 스워치 → hex
    swatch.addEventListener('input', (e) => {
      const val = e.target.value;
      state[stateKey] = val;
      hex.value = val.toUpperCase();
      hex.classList.remove('invalid');
      updateCssVariables();
      if (alsoUpdatePreview) updatePreview();
    });

    // hex → 스워치
    hex.addEventListener('input', () => {
      let val = hex.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        hex.classList.remove('invalid');
        swatch.value = val;
        state[stateKey] = val;
        updateCssVariables();
        if (alsoUpdatePreview) updatePreview();
      } else {
        hex.classList.add('invalid');
      }
    });

    hex.addEventListener('blur', () => {
      // 포커스 아웃 시 유효한 값으로 복원
      hex.value = state[stateKey].toUpperCase();
      hex.classList.remove('invalid');
    });
  }

  setupColorPair('color-primary', 'color-primary-hex', 'colorPrimary', true);
  setupColorPair('color-secondary', 'color-secondary-hex', 'colorSecondary', false);
  setupColorPair('color-accent', 'color-accent-hex', 'colorAccent', false);

  elements.bulletBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.bulletBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.bulletStyle = btn.dataset.bullet;
      updateCssVariables();
      updatePreview();
    });
  });

  // 타이틀 스타일 (인크루트 최종 출력용)
  const titleStyleSelect = document.getElementById('title-style');
  if (titleStyleSelect) {
    titleStyleSelect.value = state.titleStyle;
    titleStyleSelect.addEventListener('change', (e) => {
      state.titleStyle = e.target.value;
      renderTitleStyleOptions();
      refreshTitleStyleInPreview();
    });
    renderTitleStyleOptions();
  }

  // 테이블 헤더 색상
  setupColorPair('th-color', 'th-color-hex', 'thColor', false);
  setupColorPair('th-text-color', 'th-text-color-hex', 'thTextColor', false);

  // Action Buttons
  elements.btnRuleConvert.addEventListener('click', handleRuleConvert);
  elements.btnConvert.addEventListener('click', handleConvert);
  elements.btnCopyHtml.addEventListener('click', handleCopyHtml);
  elements.btnDownload.addEventListener('click', handleDownload);
  const btnDownloadExternal = document.getElementById('btn-download-external');
  if (btnDownloadExternal) btnDownloadExternal.addEventListener('click', handleDownloadExternal);
  const btnDownloadPng = document.getElementById('btn-download-png');
  if (btnDownloadPng) btnDownloadPng.addEventListener('click', handleDownloadPng);

  // build 418: 이미지 저장 포맷 셀렉트 (PNG/JPG/PDF)
  const btnFormatToggle = document.getElementById('btn-image-save-format-toggle');
  const formatMenu = document.getElementById('image-save-format-menu');
  const formatLabel = document.getElementById('image-save-format-label');
  const savedFormat = (localStorage.getItem('image_save_format') || 'png').toLowerCase();
  state.imageSaveFormat = savedFormat;
  if (formatLabel) formatLabel.textContent = '(' + savedFormat.toUpperCase() + ')';
  if (btnFormatToggle && formatMenu) {
    btnFormatToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      formatMenu.classList.toggle('hidden');
    });
    formatMenu.querySelectorAll('button[data-format]').forEach(b => {
      b.addEventListener('click', () => {
        const fmt = b.dataset.format.toLowerCase();
        state.imageSaveFormat = fmt;
        localStorage.setItem('image_save_format', fmt);
        if (formatLabel) formatLabel.textContent = '(' + fmt.toUpperCase() + ')';
        formatMenu.classList.add('hidden');
      });
    });
    document.addEventListener('click', (e) => {
      if (!formatMenu.contains(e.target) && e.target !== btnFormatToggle) {
        formatMenu.classList.add('hidden');
      }
    });
  }
  const btnPreviewOgCrop = document.getElementById('btn-preview-og-crop');
  if (btnPreviewOgCrop) btnPreviewOgCrop.addEventListener('click', startPreviewOgCrop);
  const btnPreviewCropConfirm = document.getElementById('btn-preview-crop-confirm');
  if (btnPreviewCropConfirm) btnPreviewCropConfirm.addEventListener('click', confirmPreviewOgCrop);
  const btnPreviewCropCancel = document.getElementById('btn-preview-crop-cancel');
  if (btnPreviewCropCancel) btnPreviewCropCancel.addEventListener('click', cancelPreviewOgCrop);

  // 초기화 버튼
  const btnResetAll = document.getElementById('btn-reset-all');
  if (btnResetAll) btnResetAll.addEventListener('click', resetAll);

  // Source Editor - 실시간 미리보기 반영
  elements.sourceEditor.addEventListener('input', () => {
    state.sourceContent = elements.sourceEditor.innerHTML;
    // 실시간 미리보기 업데이트
    updateLivePreview();
  });

  elements.sourceEditor.addEventListener('paste', handlePaste);
  elements.btnClearSource.addEventListener('click', () => {
    elements.sourceEditor.innerHTML = '';
    state.sourceContent = '';
    state.convertedHtml = '';
    clearOriginalSource();
    updatePreview();
  });

  // 원문 붙여넣기 → processInputSource (자동 변환)
  if (elements.originalViewer) {
    elements.originalViewer.addEventListener('paste', async (e) => {
      e.preventDefault();
      const clipData = e.clipboardData;
      const plainText = clipData.getData('text/plain');
      const htmlData = clipData.getData('text/html');

      // HTML 코드 감지: 평문이 HTML 태그로 시작하는 경우 → 변환 없이 미리보기 직접 적용
      if (/^\s*</.test(plainText)) {
        const rawHtml = plainText.trim();
        elements.originalViewer.innerHTML = rawHtml;
        saveOriginalSource('paste', rawHtml, { pastedAt: new Date().toISOString(), directHtml: true });
        state.convertedHtml = rawHtml;
        state.sourceContent = rawHtml;

        // 완전한 인크루트 템플릿(templwrap_v3)인 경우 → templ_header 보존을 위해 직접 렌더링
        // (updatePreview 경유 시 templ_header가 제거되고 기본 KV 헤더로 덮어씌워짐)
        if (/id=["']?templwrap_v3/i.test(rawHtml)) {
          elements.previewContent.innerHTML = rawHtml;
          applyIncruitTableClassesToDom(elements.previewContent);
          fixDoubleMarkers();
          syncKvVisibility();
          syncNonKvFieldsVisibility();
          refreshJobNumberInPreview();
          refreshBottomButtonsInPreview();
          if (state.editMode) setupInlineEditors();
          saveSession();
        } else {
          updatePreview();
        }

        setViewAndActivateTab('preview');
        addMessage('assistant', '✓ HTML 코드를 감지했습니다. 변환 없이 미리보기에 적용합니다.');
        return;
      }

      // 일반 텍스트: 기존 동작 유지
      const html = htmlData || plainText.replace(/</g, '&lt;').replace(/\n/g, '<br>');
      if (!html.trim()) return;
      elements.originalViewer.innerHTML = html;
      addMessage('assistant', '✓ 원문에 내용을 붙여넣었습니다. 자동 변환을 시작합니다.');
      await processInputSource(html, { type: 'paste', pastedAt: new Date().toISOString() });
    });
  }

  // "변환문에 복원" 버튼
  document.getElementById('btn-restore-source')?.addEventListener('click', () => {
    if (state.originalSource) {
      restoreOriginalSource();
      // 변환문 탭으로 전환
      elements.viewBtns.forEach(b => b.classList.remove('active'));
      const sourceBtn = document.querySelector('[data-view="source"]');
      if (sourceBtn) sourceBtn.classList.add('active');
      setView('source');
    }
  });

  // View Toggle (변환 중이면 미리보기/HTML코드 탭 차단)
  elements.viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (state.isLoading && (view === 'preview' || view === 'code')) return;
      elements.viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setView(view);
    });
  });

  // HTML 코드 직접 편집 → 미리보기 반영
  const btnApplyHtml = document.getElementById('btn-apply-html');
  let htmlDirty = false;

  elements.htmlCode.addEventListener('input', () => {
    if (!htmlDirty) {
      htmlDirty = true;
      if (btnApplyHtml) btnApplyHtml.classList.remove('hidden');
    }
  });

  if (btnApplyHtml) {
    btnApplyHtml.addEventListener('click', () => {
      applyEditedHtml();
      htmlDirty = false;
      btnApplyHtml.classList.add('hidden');
    });
  }

  // Ctrl+Enter / Cmd+Enter 로 즉시 반영
  elements.htmlCode.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      applyEditedHtml();
      htmlDirty = false;
      if (btnApplyHtml) btnApplyHtml.classList.add('hidden');
    }
  });

  // Chat
  elements.btnSend.addEventListener('click', handleSendMessage);
  let chatPendingSend = false;
  elements.chatInput.addEventListener('compositionstart', () => {
    chatPendingSend = false;
  });
  elements.chatInput.addEventListener('compositionend', () => {
    if (chatPendingSend) {
      chatPendingSend = false;
      setTimeout(() => handleSendMessage(), 0);
    }
  });
  elements.chatInput.addEventListener('keydown', (e) => {
    // 한글 입력 중(composition) Enter는 조합 종료 후 전송
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.isComposing) {
        e.preventDefault();
        chatPendingSend = true;
        return;
      }
      e.preventDefault();
      setTimeout(() => handleSendMessage(), 0);
    }
  });

  elements.btnAiSettings.addEventListener('click', () => {
    openAiSettingsModal();
  });

  elements.btnClearChat.addEventListener('click', () => {
    if (confirm('채팅 기록을 삭제하시겠습니까?')) {
      state.messages = [];
      renderMessages();
      saveSession();
    }
  });

  elements.quickActionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      handleQuickAction(btn.dataset.action);
    });
  });

  // Modal - AI Settings
  setupAiSettingsModal();

  // HTML 가져오기 모달
  setupImportHtmlModal();
}

// ============================================
// HTML 가져오기 모달 이벤트 설정
// ============================================
function setupImportHtmlModal() {
  const btnImport = document.getElementById('btn-import-html');
  const btnClose = document.getElementById('btn-import-modal-close');
  const btnCancel = document.getElementById('btn-import-cancel');
  const btnConfirm = document.getElementById('btn-import-confirm');
  const modal = document.getElementById('html-import-modal');
  const textarea = document.getElementById('import-html-textarea');
  const backdrop = modal?.querySelector('.modal-backdrop');

  if (btnImport) btnImport.addEventListener('click', () => openImportModal());
  if (btnClose) btnClose.addEventListener('click', closeImportModal);
  if (btnCancel) btnCancel.addEventListener('click', closeImportModal);
  if (backdrop) backdrop.addEventListener('click', closeImportModal);
  if (btnConfirm) btnConfirm.addEventListener('click', handleImportHtml);

  // textarea 변경 시 실시간 분석 (디바운스 500ms)
  let analyzeTimer;
  if (textarea) {
    textarea.addEventListener('input', () => {
      clearTimeout(analyzeTimer);
      analyzeTimer = setTimeout(() => analyzeImportedHtml(textarea.value), 500);
    });
  }

  // 탭 전환
  document.querySelectorAll('.import-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.import-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.importTab;
      document.getElementById('import-tab-paste').classList.toggle('hidden', tab !== 'paste');
      document.getElementById('import-tab-file').classList.toggle('hidden', tab !== 'file');
    });
  });

  // 파일 선택
  const btnFileSelect = document.getElementById('btn-import-file-select');
  const fileInput = document.getElementById('import-html-file');
  if (btnFileSelect && fileInput) {
    btnFileSelect.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        textarea.value = reader.result;
        analyzeImportedHtml(reader.result);
        // paste 탭으로 전환하여 결과 표시
        document.querySelectorAll('.import-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-import-tab="paste"]')?.classList.add('active');
        document.getElementById('import-tab-paste')?.classList.remove('hidden');
        document.getElementById('import-tab-file')?.classList.add('hidden');
      };
      reader.readAsText(file);
    });
  }
}

// ============================================
// AI Settings Modal
// ============================================
function setupAiSettingsModal() {
  // Provider Card Selection
  elements.providerCards.forEach(card => {
    card.addEventListener('click', () => {
      elements.providerCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const provider = card.dataset.provider;
      selectProvider(provider);
    });
  });

  // Toggle API Key visibility
  elements.btnToggleKey.addEventListener('click', () => {
    const input = elements.aiApiKey;
    const isMasked = input.classList.contains('api-key-masked');
    if (isMasked) {
      input.classList.remove('api-key-masked');
      elements.btnToggleKey.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
        </svg>
      `;
    } else {
      input.classList.add('api-key-masked');
      elements.btnToggleKey.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>
      `;
    }
  });

  // Connection Test
  elements.btnTestConnection.addEventListener('click', testAiConnection);

  // Cancel button
  document.getElementById('btn-cancel-ai-settings').addEventListener('click', () => {
    elements.aiSettingsModal.classList.add('hidden');
    resetModalState();
  });

  // Save button
  document.getElementById('btn-save-ai-settings').addEventListener('click', saveAiSettings);

  // Backdrop click to close
  document.querySelector('#ai-settings-modal .modal-backdrop').addEventListener('click', () => {
    elements.aiSettingsModal.classList.add('hidden');
    resetModalState();
  });

  // API Key input change - debounce model fetch
  let apiKeyFetchTimer = null;
  elements.aiApiKey.addEventListener('input', () => {
    elements.connectionStatus.classList.add('hidden');

    // Auto-fetch models after typing stops (800ms debounce)
    clearTimeout(apiKeyFetchTimer);
    const key = elements.aiApiKey.value.trim();
    if (key.length > 10) {
      apiKeyFetchTimer = setTimeout(() => {
        const selectedCard = document.querySelector('.ai-provider-card.selected');
        if (selectedCard) {
          fetchAndRenderModels(selectedCard.dataset.provider, key);
        }
      }, 800);
    }
  });

  // Refresh models button
  elements.btnRefreshModels.addEventListener('click', () => {
    const selectedCard = document.querySelector('.ai-provider-card.selected');
    const apiKey = elements.aiApiKey.value.trim();
    if (!selectedCard) {
      showModelFetchStatus('AI 서비스를 먼저 선택해주세요.', 'error');
      return;
    }
    if (!apiKey) {
      showModelFetchStatus('API 키를 먼저 입력해주세요.', 'error');
      return;
    }
    fetchAndRenderModels(selectedCard.dataset.provider, apiKey);
  });
}

function selectProvider(provider) {
  const config = AI_PROVIDERS[provider];
  if (!config) return;

  // Update API key label and help link
  elements.apiKeyLabel.textContent = `${config.name} API Key`;
  elements.apiKeyHelpLink.href = config.apiKeyHelp;
  elements.aiApiKey.placeholder = config.apiKeyPlaceholder;

  // Show model selection with fallback models
  elements.modelSelection.classList.remove('hidden');
  renderModelOptions(config.models);

  // Clear previous connection status
  elements.connectionStatus.classList.add('hidden');
  elements.modelFetchStatus.classList.add('hidden');

  // Load saved API key for this provider
  const savedKey = localStorage.getItem(`ai_api_key_${provider}`) || '';
  elements.aiApiKey.value = savedKey;

  // If API key exists, auto-fetch models
  if (savedKey) {
    fetchAndRenderModels(provider, savedKey);
  }
}

function renderModelOptions(models, savedModelId) {
  const saved = savedModelId || localStorage.getItem('ai_model') || '';
  elements.aiModel.innerHTML = models.map(m => {
    const isSelected = saved ? m.id === saved : m.default;
    return `<option value="${m.id}" ${isSelected ? 'selected' : ''}>${m.name}</option>`;
  }).join('');
}

function showModelFetchStatus(message, type = 'info') {
  elements.modelFetchStatus.textContent = message;
  elements.modelFetchStatus.className = `text-xs mt-1 ${
    type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-gray-500'
  }`;
  elements.modelFetchStatus.classList.remove('hidden');
}

function setRefreshLoading(loading) {
  const icon = elements.btnRefreshModels.querySelector('.refresh-icon');
  if (loading) {
    icon.style.animation = 'spin 1s linear infinite';
    elements.refreshModelsText.textContent = '조회 중...';
    elements.btnRefreshModels.disabled = true;
  } else {
    icon.style.animation = '';
    elements.refreshModelsText.textContent = 'API에서 가져오기';
    elements.btnRefreshModels.disabled = false;
  }
}

// ============================================
// API Model Fetching
// ============================================

// OpenAI model priority for filtering/sorting
const OPENAI_MODEL_PRIORITY = [
  'gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o3', 'o4-mini',
  'gpt-4-turbo', 'gpt-4.5-preview', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'
];

// Claude: CORS prevents listing → fallback always used, but keep latest
const CLAUDE_FALLBACK_MODELS = AI_PROVIDERS.claude.models;

async function fetchAndRenderModels(provider, apiKey) {
  setRefreshLoading(true);
  showModelFetchStatus('API에서 최신 모델 목록을 조회하는 중...', 'info');

  try {
    let models;
    switch (provider) {
      case 'openai':
        models = await fetchOpenAIModels(apiKey);
        break;
      case 'claude':
        models = await fetchClaudeModels(apiKey);
        break;
      case 'gemini':
        models = await fetchGeminiModels(apiKey);
        break;
      default:
        models = null;
    }

    if (models && models.length > 0) {
      renderModelOptions(models);
      const count = models.length;
      showModelFetchStatus(`✓ API에서 ${count}개 모델 로드 완료`, 'success');
    } else {
      // Fallback to hardcoded
      renderModelOptions(AI_PROVIDERS[provider].models);
      showModelFetchStatus('기본 모델 목록 사용 중', 'info');
    }
  } catch (err) {
    console.warn('Model fetch failed:', err);
    renderModelOptions(AI_PROVIDERS[provider].models);
    showModelFetchStatus(`조회 실패: ${err.message} (기본 목록 사용)`, 'error');
  } finally {
    setRefreshLoading(false);
  }
}

async function fetchOpenAIModels(apiKey) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!response.ok) throw new Error('API 키가 유효하지 않습니다');

  const data = await response.json();
  const allModels = data.data || [];

  // Filter to chat-compatible models only
  const chatPatterns = [
    /^gpt-4o/, /^gpt-4\.1/, /^gpt-4\.5/, /^gpt-4-turbo/,
    /^gpt-4$/, /^gpt-3\.5-turbo$/, /^o[1-4](-mini)?$/
  ];

  const filtered = allModels
    .filter(m => chatPatterns.some(p => p.test(m.id)))
    .filter(m => !m.id.includes('realtime') && !m.id.includes('audio') && !m.id.includes('transcribe') && !m.id.includes('tts') && !m.id.includes('search'));

  // Deduplicate: keep only base names (remove date suffixes like -2024-11-20)
  const seen = new Set();
  const deduped = [];
  for (const m of filtered) {
    const base = m.id.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    if (!seen.has(base)) {
      seen.add(base);
      deduped.push({ id: m.id, baseName: base });
    }
  }

  // Sort by priority
  deduped.sort((a, b) => {
    const aIdx = OPENAI_MODEL_PRIORITY.indexOf(a.baseName);
    const bIdx = OPENAI_MODEL_PRIORITY.indexOf(b.baseName);
    const aPri = aIdx === -1 ? 999 : aIdx;
    const bPri = bIdx === -1 ? 999 : bIdx;
    return aPri - bPri;
  });

  // Format for display
  return deduped.slice(0, 10).map((m, i) => ({
    id: m.id,
    name: `${m.baseName}${i === 0 ? ' (추천)' : ''}`,
    default: i === 0
  }));
}

async function fetchClaudeModels(apiKey) {
  // Claude API requires CORS proxy for browser - use enhanced fallback
  // Try the models endpoint (may fail due to CORS)
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const allModels = data.data || [];

      // Filter to latest chat models
      const chatModels = allModels
        .filter(m => m.id && (m.id.includes('claude') && !m.id.includes('instant')))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

      if (chatModels.length > 0) {
        // Group by family, pick latest of each
        const families = {};
        for (const m of chatModels) {
          // Extract family: claude-opus-4-6, claude-sonnet-4-5, claude-haiku-4-5
          const family = m.id.replace(/-\d{8}$/, '');
          if (!families[family]) families[family] = m;
        }

        const priorityOrder = ['opus', 'sonnet', 'haiku'];
        return Object.values(families)
          .sort((a, b) => {
            const aP = priorityOrder.findIndex(p => a.id.includes(p));
            const bP = priorityOrder.findIndex(p => b.id.includes(p));
            return (aP === -1 ? 99 : aP) - (bP === -1 ? 99 : bP);
          })
          .slice(0, 8)
          .map((m, i) => {
            const displayName = m.display_name || m.id;
            return {
              id: m.id,
              name: `${displayName}${i === 0 ? ' (추천)' : ''}`,
              default: i === 0
            };
          });
      }
    }
  } catch (e) {
    // CORS error expected in browser
  }

  // Fallback: return enhanced static list
  return CLAUDE_FALLBACK_MODELS;
}

async function fetchGeminiModels(apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  if (!response.ok) throw new Error('API 키가 유효하지 않습니다');

  const data = await response.json();
  const allModels = data.models || [];

  // Filter to generateContent-capable models only
  const chatModels = allModels
    .filter(m =>
      m.supportedGenerationMethods?.includes('generateContent') &&
      m.name && !m.name.includes('embedding') && !m.name.includes('aqa') &&
      !m.name.includes('tts') && !m.name.includes('image') &&
      !m.name.includes('audio') && !m.name.includes('bisheng')
    );

  // Priority patterns for sorting
  const geminiPriority = [
    'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
    'gemini-2.0-flash', 'gemini-2.0-flash-lite',
    'gemini-1.5-pro', 'gemini-1.5-flash'
  ];

  // Extract model ID from name (models/gemini-2.5-flash → gemini-2.5-flash)
  const formatted = chatModels.map(m => {
    const id = m.name.replace('models/', '');
    return { id, displayName: m.displayName || id, description: m.description || '' };
  });

  // Deduplicate keeping latest versions
  const seen = new Set();
  const deduped = [];
  for (const m of formatted) {
    // Remove date/version suffixes for grouping
    const base = m.id.replace(/-\d{3,}$/, '').replace(/-latest$/, '').replace(/-preview.*$/, '');
    if (!seen.has(base)) {
      seen.add(base);
      deduped.push({ ...m, baseName: base });
    }
  }

  // Sort by priority
  deduped.sort((a, b) => {
    const aIdx = geminiPriority.findIndex(p => a.baseName.startsWith(p));
    const bIdx = geminiPriority.findIndex(p => b.baseName.startsWith(p));
    const aPri = aIdx === -1 ? 999 : aIdx;
    const bPri = bIdx === -1 ? 999 : bIdx;
    return aPri - bPri;
  });

  return deduped.slice(0, 10).map((m, i) => ({
    id: m.id,
    name: `${m.displayName}${i === 0 ? ' (추천)' : ''}`,
    default: i === 0
  }));
}

function resetModalState() {
  elements.connectionStatus.classList.add('hidden');
}

async function testAiConnection() {
  const selectedCard = document.querySelector('.ai-provider-card.selected');
  if (!selectedCard) {
    showConnectionStatus('error', 'AI 서비스를 선택해주세요.');
    return;
  }

  const provider = selectedCard.dataset.provider;
  const apiKey = elements.aiApiKey.value.trim();

  if (!apiKey) {
    showConnectionStatus('error', 'API 키를 입력해주세요.');
    return;
  }

  // Show testing status
  showConnectionStatus('testing', '연결 테스트 중...');
  elements.btnTestConnection.disabled = true;

  try {
    const result = await testProviderConnection(provider, apiKey);
    if (result.success) {
      showConnectionStatus('success', `✓ 연결 성공! (${result.model || provider})`);
      state.isConnected = true;
    } else {
      showConnectionStatus('error', `✗ 연결 실패: ${result.error}`);
      state.isConnected = false;
    }
  } catch (error) {
    showConnectionStatus('error', `✗ 오류: ${error.message}`);
    state.isConnected = false;
  } finally {
    elements.btnTestConnection.disabled = false;
  }
}

async function testProviderConnection(provider, apiKey) {
  switch (provider) {
    case 'openai':
      return await testOpenAI(apiKey);
    case 'claude':
      return await testClaude(apiKey);
    case 'gemini':
      return await testGemini(apiKey);
    default:
      return { success: false, error: '알 수 없는 AI 서비스' };
  }
}

async function testOpenAI(apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (response.ok) {
      return { success: true, model: 'GPT-4o' };
    } else {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'API 키가 유효하지 않습니다' };
    }
  } catch (e) {
    return { success: false, error: '네트워크 오류' };
  }
}

async function testClaude(apiKey) {
  try {
    // 1) 키 형식 사전 검증
    if (!apiKey.startsWith('sk-ant-')) {
      return { success: false, error: 'API 키 형식이 올바르지 않습니다 (sk-ant-로 시작해야 함)' };
    }

    // 2) CORS 프록시 경유 실제 API 호출 검증
    const proxyBase = '/proxy/?url=';
    const targetUrl = 'https://api.anthropic.com/v1/messages';
    let url;

    try {
      const healthResp = await fetch(PROXY_HEALTH_URL, { signal: AbortSignal.timeout(2000) });
      url = healthResp.ok ? proxyBase + encodeURIComponent(targetUrl) : targetUrl;
    } catch {
      url = targetUrl;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'hi' }]
      })
    });

    if (response.ok) {
      return { success: true, model: 'Claude Opus 4.6' };
    }

    const error = await response.json().catch(() => ({}));
    const msg = error.error?.message || `API 오류 (${response.status})`;

    if (response.status === 401) {
      return { success: false, error: 'API 키가 유효하지 않습니다. 키를 확인해주세요.' };
    }

    return { success: false, error: msg };
  } catch (e) {
    // 네트워크 오류 시 형식 검증만으로 fallback
    if (apiKey.startsWith('sk-ant-')) {
      return { success: true, model: 'Claude (형식 검증만 — 프록시 연결 필요)' };
    }
    return { success: false, error: '검증 오류: ' + e.message };
  }
}

async function testGemini(apiKey) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (response.ok) {
      return { success: true, model: 'Gemini 2.5 Flash' };
    } else {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'API 키가 유효하지 않습니다' };
    }
  } catch (e) {
    return { success: false, error: '네트워크 오류' };
  }
}

function showConnectionStatus(type, message) {
  elements.connectionStatus.className = `connection-status ${type}`;
  elements.connectionStatus.innerHTML = `
    <span>${type === 'testing' ? '<span class="loading"></span>' : ''}</span>
    <span>${message}</span>
  `;
  elements.connectionStatus.classList.remove('hidden');
}

function saveAiSettings() {
  const selectedCard = document.querySelector('.ai-provider-card.selected');
  if (!selectedCard) {
    showToast('AI 서비스를 먼저 선택해주세요.');
    return;
  }

  const provider = selectedCard.dataset.provider;
  const apiKey = elements.aiApiKey.value.trim();
  const model = elements.aiModel?.value || '';

  if (!apiKey) {
    showToast('API 키를 입력해주세요.');
    return;
  }

  // Save to state and localStorage
  state.provider = provider;
  state.apiKey = apiKey;
  state.model = model;

  localStorage.setItem('ai_provider', provider);
  localStorage.setItem('ai_api_key', apiKey);
  localStorage.setItem(`ai_api_key_${provider}`, apiKey);
  localStorage.setItem('ai_model', model);
  if (provider === 'gemini' && model) localStorage.setItem('ai_model_gemini', model);

  // Save image search API keys
  const unsplashKey = document.getElementById('img-api-key-unsplash')?.value.trim() || '';
  const pexelsKey = document.getElementById('img-api-key-pexels')?.value.trim() || '';
  const pixabayKey = document.getElementById('img-api-key-pixabay')?.value.trim() || '';
  state.unsplashApiKey = unsplashKey;
  state.pexelsApiKey = pexelsKey;
  state.pixabayApiKey = pixabayKey;
  if (unsplashKey) localStorage.setItem('unsplash_api_key', unsplashKey);
  else localStorage.removeItem('unsplash_api_key');
  if (pexelsKey) localStorage.setItem('pexels_api_key', pexelsKey);
  else localStorage.removeItem('pexels_api_key');
  if (pixabayKey) localStorage.setItem('pixabay_api_key', pixabayKey);
  else localStorage.removeItem('pixabay_api_key');

  // Save Figma token
  const figmaToken = document.getElementById('figma-token')?.value.trim() || '';
  state.figmaToken = figmaToken;
  if (figmaToken) localStorage.setItem('figma_token', figmaToken);
  else localStorage.removeItem('figma_token');
  updateFigmaTokenWarning();

  // Close modal and update status
  elements.aiSettingsModal.classList.add('hidden');
  updateAiStatus();
  updateImgSearchKeyWarning();

  // Show success message
  addMessage('assistant', `✓ ${AI_PROVIDERS[provider].name} 연결이 설정되었습니다. (모델: ${model || 'default'})`);
}

function openAiSettingsModal() {
  elements.aiSettingsModal.classList.remove('hidden');

  // Pre-select current provider
  elements.providerCards.forEach(card => {
    card.classList.remove('selected');
    if (card.dataset.provider === state.provider) {
      card.classList.add('selected');
      selectProvider(state.provider);
    }
  });

  // If no provider selected, select first one
  if (!document.querySelector('.ai-provider-card.selected')) {
    const firstCard = elements.providerCards[0];
    if (firstCard) {
      firstCard.classList.add('selected');
      selectProvider(firstCard.dataset.provider);
    }
  }

  // Pre-fill image search API keys
  const unsplashInput = document.getElementById('img-api-key-unsplash');
  const pexelsInput = document.getElementById('img-api-key-pexels');
  const pixabayInput = document.getElementById('img-api-key-pixabay');
  if (unsplashInput) unsplashInput.value = state.unsplashApiKey;
  if (pexelsInput) pexelsInput.value = state.pexelsApiKey;
  if (pixabayInput) pixabayInput.value = state.pixabayApiKey;

  // Pre-fill Figma token
  const figmaTokenInput = document.getElementById('figma-token');
  if (figmaTokenInput) figmaTokenInput.value = state.figmaToken;
}

// ============================================
// View Management
// ============================================
function setView(view) {
  state.activeView = view;

  // 모든 컨테이너 숨기기
  elements.originalContainer.classList.add('hidden');
  elements.sourceContainer.classList.add('hidden');
  elements.previewContainer.classList.add('hidden');
  elements.codeContainer.classList.add('hidden');
  elements.codeContainer.classList.remove('split-pane');
  elements.imagemapContainer?.classList.add('hidden');

  switch (view) {
    case 'dual':
      elements.originalContainer.classList.remove('hidden');
      elements.sourceContainer.classList.remove('hidden');
      populateOriginalViewer();
      break;
    case 'original':
      elements.originalContainer.classList.remove('hidden');
      populateOriginalViewer();
      break;
    case 'source':
      elements.sourceContainer.classList.remove('hidden');
      break;
    case 'preview':
      elements.previewContainer.classList.remove('hidden');
      break;
    case 'split':
      elements.codeContainer.classList.remove('hidden');
      elements.previewContainer.classList.remove('hidden');
      elements.codeContainer.classList.add('split-pane');
      updateHtmlCode();
      if (window._cmEditor) setTimeout(() => window._cmEditor.refresh(), 50);
      break;
    case 'code':
      elements.codeContainer.classList.remove('hidden');
      updateHtmlCode();
      if (window._cmEditor) setTimeout(() => window._cmEditor.refresh(), 50);
      break;
    case 'imagemap':
      elements.imagemapContainer?.classList.remove('hidden');
      break;
  }
}

// 뷰 전환 + 탭 버튼 활성화 (프로그래밍 방식)
function setViewAndActivateTab(view) {
  elements.viewBtns.forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-view="${view}"]`);
  if (btn) btn.classList.add('active');
  setView(view);
}

function populateOriginalViewer() {
  if (!elements.originalViewer) return;
  const label = document.getElementById('original-source-label');
  const restoreBtn = document.getElementById('btn-restore-source');
  const codeViewBtn = document.getElementById('btn-toggle-code-view');

  if (state.originalSource && state.originalSource.raw) {
    // 코드 보기 상태 초기화
    elements.originalViewer.classList.remove('original-code-view');
    elements.originalViewer.contentEditable = 'true';
    elements.originalViewer.innerHTML = state.originalSource.raw;
    if (codeViewBtn) {
      codeViewBtn.textContent = '코드 보기';
      // HTML 타입일 때만 코드 보기 버튼 표시
      if (state.originalSource.type === 'html') {
        codeViewBtn.classList.remove('hidden');
      } else {
        codeViewBtn.classList.add('hidden');
      }
    }
    if (label) {
      const srcLabel = getOriginalSourceLabel();
      const time = new Date(state.originalSource.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      label.textContent = `${srcLabel} · ${time}`;
    }
    if (restoreBtn) restoreBtn.classList.remove('hidden');
  } else {
    elements.originalViewer.innerHTML = '<div class="empty-state"><p>아직 원문이 없습니다.<br>채용공고 HTML을 여기에 붙여넣거나,<br>파일 첨부 또는 URL 입력으로 원문을 추가하세요.</p></div>';
    if (label) label.textContent = '';
    if (codeViewBtn) codeViewBtn.classList.add('hidden');
    if (restoreBtn) restoreBtn.classList.add('hidden');
  }
}

// ============================================
// KV Visibility Sync
// ============================================
function syncKvVisibility() {
  const headerArea = document.getElementById('kv-header-area');
  const kvCard = document.getElementById('kv-preview-card');
  const topImg = document.getElementById('kv-preview-top-img');

  // keyVisualUrl(사용자가 직접 입력한 standalone 이미지 URL)만 사용
  // bgImageUrl은 KV 카드 배경용이므로 KV 비활성 시 top_img 폴백으로 쓰지 않음
  const topImgUrl = state.keyVisualUrl || '';

  if (state.kvEnabled) {
    // KV 토글 ON: KV 카드 표시, top_img_v2 숨김
    if (headerArea) {
      headerArea.classList.remove('hidden');
      headerArea.style.display = '';
    }
    if (kvCard) kvCard.style.display = '';
    if (topImg) topImg.style.display = 'none';
  } else {
    // KV 토글 OFF: KV 카드 숨김, top_img_v2 표시 (URL이 있을 때만)
    if (kvCard) kvCard.style.display = 'none';
    if (topImg) {
      if (topImgUrl) {
        topImg.src = topImgUrl;
        topImg.style.display = '';
      } else {
        topImg.style.display = 'none';
      }
    }
    // 이미지도 없고 공고번호도 없으면 헤더 영역 자체 숨김
    if (headerArea) {
      const hasContent = !!topImgUrl || !!state.jobNumber || !!state.headerCompanyName || !!state.headerDate;
      headerArea.classList.toggle('hidden', !hasContent);
    }
  }

  // 본문 중복 요소 숨기기 (h1 제목, key-visual 이미지)
  const preview = document.getElementById('preview-content');
  if (!preview) return;
  const h1 = preview.querySelector('h1');
  if (h1) h1.style.display = state.kvEnabled ? 'none' : '';
  const kvImg = preview.querySelector('.key-visual');
  if (kvImg) kvImg.style.display = state.kvEnabled ? 'none' : '';
}

/** KV 활성화 시 채용공고번호/기업명/날짜 입력 섹션 숨김 처리 */
function syncNonKvFieldsVisibility() {
  const ids = ['non-kv-job-number-group', 'non-kv-company-group', 'non-kv-date-group'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = state.kvEnabled ? 'none' : '';
  });
}

// ============================================
// Paste Handler
// ============================================
function handlePaste(e) {
  e.preventDefault();

  // Get HTML from clipboard if available
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  const rawHtml = html || text;

  // 완성된 HTML 감지 → 가져오기 안내 배너
  if (rawHtml && isCompletedHtml(rawHtml)) {
    showImportSuggestion(rawHtml);
    return;
  }

  if (html) {
    // Clean and insert HTML
    const cleaned = cleanHtml(html);
    document.execCommand('insertHTML', false, cleaned);
  } else {
    // Insert plain text with line breaks
    const formatted = text.replace(/\n/g, '<br>');
    document.execCommand('insertHTML', false, formatted);
  }

  const pastedHtml = elements.sourceEditor.innerHTML;
  // processInputSource로 통합 처리 (원문 저장 → 미리보기 갱신)
  processInputSource(pastedHtml, { type: 'paste', pastedAt: new Date().toISOString() });
}

function cleanHtml(html) {
  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove unwanted elements
  const unwanted = temp.querySelectorAll('script, style, meta, link');
  unwanted.forEach(el => el.remove());

  // Clean up styles but preserve structure
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    // Keep only basic formatting
    const tag = el.tagName.toLowerCase();
    if (!['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'strong', 'b', 'em', 'i', 'u', 'span', 'div', 'img', 'a', 'figure', 'figcaption'].includes(tag)) {
      // Replace with span
      const span = document.createElement('span');
      span.innerHTML = el.innerHTML;
      el.parentNode.replaceChild(span, el);
    }

    const tagLc = el.tagName.toLowerCase();
    // <img>: src/alt/width/height만 보존
    if (tagLc === 'img') {
      const src = el.getAttribute('src');
      const alt = el.getAttribute('alt') || '';
      const width = el.getAttribute('width') || '';
      const height = el.getAttribute('height') || '';
      Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
      if (src) el.setAttribute('src', src);
      if (alt) el.setAttribute('alt', alt);
      if (width) el.setAttribute('width', width);
      if (height) el.setAttribute('height', height);
      return;
    }
    // <a>: href만 보존
    if (tagLc === 'a') {
      const href = el.getAttribute('href');
      Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
      if (href) el.setAttribute('href', href);
      return;
    }

    // Remove inline styles (td/th의 text-align은 보존)
    if ((tagLc === 'td' || tagLc === 'th') && el.style.textAlign) {
      const align = el.style.textAlign;
      el.removeAttribute('style');
      el.style.textAlign = align;
    } else {
      el.removeAttribute('style');
    }
    // class 보존: 인크루트 표준 클래스만 (templ_*, sec_*, title_*, bul_*, bTable_*, olist, ulist, kolist, olnum, noti, table_*, fs15, stable, has-marker, legal-*, top_img_v2, h20, sec_wrap, kv-card, kv-*)
    const cls = el.getAttribute('class');
    if (cls) {
      const incruitPattern = /^(templ_|sec_|title_|bul_|bTable_|table_|tempNew|olist|ulist|kolist|olnum|noti|fs|stable|has-marker|legal-|top_img|h20|kv-|tpl-|tempNew-|tempNew03|notice|incruit-|inckv-|copyright)/;
      const filtered = cls.split(/\s+/).filter(c => incruitPattern.test(c)).join(' ');
      if (filtered) el.setAttribute('class', filtered);
      else el.removeAttribute('class');
    }
  });

  return temp.innerHTML;
}

// ============================================
// AI 전송용 HTML 정제 (구조 보존, 불필요 속성만 제거)
// ============================================
function sanitizeForAI(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // 1) 완전 제거 대상: 디자인/메타 요소
  temp.querySelectorAll('script, style, meta, link, input[type="hidden"], img, svg, iframe, noscript, comment').forEach(el => el.remove());

  // 2) 허용 태그 목록 (구조+의미 태그만)
  const ALLOWED_TAGS = new Set([
    'h1','h2','h3','h4','h5','h6',
    'p','br','hr',
    'ul','ol','li','dl','dt','dd',
    'table','thead','tbody','tfoot','tr','td','th','caption','colgroup','col',
    'strong','b','em','i','u','s','del','ins','sup','sub',
    'span','div','blockquote','pre','code',
    'a'
  ]);

  // 3) 허용되지 않는 태그 → 내용만 보존하고 태그 제거
  const allEls = Array.from(temp.querySelectorAll('*')).reverse();
  allEls.forEach(el => {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // 자식 노드를 부모로 이동 (내용 보존)
      while (el.firstChild) {
        el.parentNode.insertBefore(el.firstChild, el);
      }
      el.remove();
    }
  });

  // 4) 모든 속성 제거 (구조 태그의 의미적 속성만 보존)
  temp.querySelectorAll('*').forEach(el => {
    const tag = el.tagName.toLowerCase();
    const attrs = Array.from(el.attributes).map(a => a.name);
    attrs.forEach(attr => {
      // table 관련 구조 속성만 보존
      if (tag === 'td' || tag === 'th') {
        if (attr === 'colspan' || attr === 'rowspan') return;
        if (attr === 'style') {
          // text-align만 보존 (width/padding/background 등은 AI에 불필요, 오히려 테이블 재구성 유발)
          const styleVal = el.getAttribute('style') || '';
          const m = styleVal.match(/text-align\s*:\s*[^;]+/);
          if (m) {
            el.setAttribute('style', m[0]);
          } else {
            el.removeAttribute('style');
          }
          return;
        }
      }
      // a 태그의 href 보존
      if (tag === 'a' && attr === 'href') return;
      // li 태그의 data-bullet 보존 (불릿 유니코드 문자 정보)
      if (tag === 'li' && attr === 'data-bullet') return;
      // span/p/div 등의 background-color 스타일 보존 (형광펜/하이라이트)
      if (attr === 'style' && (tag === 'span' || tag === 'p' || tag === 'div')) {
        const styleVal = el.getAttribute('style') || '';
        const bgMatch = styleVal.match(/background(?:-color)?\s*:\s*[^;]+/i);
        if (bgMatch) {
          el.setAttribute('style', bgMatch[0]);
          return;
        }
      }
      // 나머지 전부 제거
      el.removeAttribute(attr);
    });
  });

  // 5) 빈 요소 정리 (내용 없는 span, div 등 — 구조 태그는 유지)
  const STRUCTURAL_TAGS = new Set(['br','hr','td','th','tr','col','colgroup']);
  temp.querySelectorAll('span, div, p, b, strong, em, i, u').forEach(el => {
    if (!el.textContent.trim() && !el.querySelector('br, img, table')) {
      el.remove();
    }
  });

  // 6) 연속된 빈 줄 축약
  let result = temp.innerHTML
    .replace(/(<br\s*\/?>[\s\n]*){3,}/gi, '<br><br>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 7) 가운뎃점 깨짐 전처리: "·"(U+00B7) UTF-8→EUC-KR 오독으로 "틀"(U+D2C0)이 된 경우 복원
  // AI에 보내기 전에 소스 텍스트를 정리하여 AI가 올바른 "·"를 받도록 함
  result = result.replace(/([가-힣])\u{D2C0}([가-힣])/gu, '$1·$2');

  return result;
}

// ============================================
// 강화된 정규화 (글자 단위 비교용)
// ============================================
function enhancedNormalize(text) {
  return text
    // HTML 엔티티 디코딩 (DOM textContent에서 이미 처리되지만 raw 입력 대비)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    // 전각→반각 ASCII (U+FF01~U+FF5E → U+0021~U+007E)
    .replace(/[\uFF01-\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    // 전각 공백 → 반각
    .replace(/\u3000/g, ' ')
    // 한국 채용공고 특수 기호 제거 (HWP/DOCX 원문에 자주 등장, AI 변환 시 <li> 등으로 대체됨)
    .replace(/[▶◀►◄▷◁▸▹▼▽▲△◆◇○●■□☆★☞☜※→←↑↓◎]/g, '')
    // 모든 공백류 → 단일 공백
    .replace(/[\s\u00A0\u200B\u200C\u200D\uFEFF]+/g, ' ')
    // 따옴표 통일
    .replace(/[""''「」『』]/g, '"')
    // 대시 통일
    .replace(/[–—―‐‑‒]/g, '-')
    // 말줄임 통일
    .replace(/…/g, '...')
    // 불릿·중점 통일
    .replace(/[·・•]/g, '.')
    .trim();
}

// ============================================
// LCS 길이 계산 (2-row DP, O(min(m,n)) 메모리)
// ============================================
function computeLCSLength(a, b) {
  // b를 짧은 쪽으로 → 메모리 절약
  if (a.length < b.length) { const t = a; a = b; b = t; }
  const n = b.length;
  let prev = new Uint32Array(n + 1);
  let curr = new Uint32Array(n + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    const tmp = prev; prev = curr; curr = tmp;
    curr.fill(0);
  }
  return prev[n];
}

// ============================================
// 블록 요소 기반 누락 구간 식별 (업로드 파일 검증용)
// p, li, td, th, h1~h6 등 리프 블록 단위로 비교 → 재정렬 허용, 오탐 대폭 감소
// ============================================
function extractSourceSegments(dom, minLen = 10) {
  const seen = new Set();
  const segments = [];
  const selector = 'p, li, td, th, h1, h2, h3, h4, h5, h6, div';
  dom.querySelectorAll(selector).forEach(el => {
    // 컨테이너 블록(자식 블록 포함) 제외 → 리프 블록만 수집
    const hasBlockChild = el.querySelector('p, div, li, td, table, ul, ol');
    if (hasBlockChild) return;
    // 불릿 기호(•→. / - / * 등)를 앞에서 제거 → 변환 후 <li> 텍스트와 일치 보장
    const raw = enhancedNormalize(el.textContent || '').trim();
    const text = raw.replace(/^[.\-\*\u2022\u25cf\u25cb\u25aa\u25ab\u25b6\u25c0\u2013\u2014\s]+/, '').trim();
    if (text.length >= minLen && !seen.has(text) && !isTemplateText(text)) {
      seen.add(text);
      segments.push(text);
    }
  });
  return segments;
}

// ============================================
// 소스 세그먼트가 변환 결과에 (퍼지) 보존됐는지 판정
// 1) exact substring 2) 구두점 제거 3) 토큰 커버리지 ≥ 85%
// 구두점/띄어쓰기/괄호 변동으로 인한 false positive 방지
// ============================================
function _stripPunctForFuzzy(s) {
  return s.replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function isSegmentPreserved(normSeg, normConverted) {
  if (!normSeg) return true;
  if (normConverted.includes(normSeg)) return true;
  const segStripped = _stripPunctForFuzzy(normSeg);
  if (segStripped.length >= 6) {
    // 매번 convStripped를 만들지 않도록 간단 캐시
    if (!isSegmentPreserved._cache || isSegmentPreserved._cacheKey !== normConverted) {
      isSegmentPreserved._cacheKey = normConverted;
      isSegmentPreserved._cache = _stripPunctForFuzzy(normConverted);
    }
    const convStripped = isSegmentPreserved._cache;
    if (convStripped.includes(segStripped)) return true;
    const tokens = segStripped.split(' ').filter(t => t.length >= 2);
    if (tokens.length >= 3) {
      const present = tokens.filter(t => convStripped.includes(t)).length;
      if (present / tokens.length >= 0.85) return true;
    }
  }
  return false;
}

// ============================================
// 누락 구간 식별 — 폴백용 (블록 요소가 없는 plain text 소스 대비)
// ============================================
function findMissingSegments(normSource, normConverted, minLen = 10) {
  const missing = [];
  let i = 0;
  while (i < normSource.length) {
    let foundEnd = i;
    for (let len = 1; len <= Math.min(60, normSource.length - i); len++) {
      const sub = normSource.substring(i, i + len);
      if (normConverted.includes(sub)) {
        foundEnd = i + len;
      } else {
        break;
      }
    }
    if (foundEnd === i) {
      let end = i + 1;
      while (end < normSource.length) {
        const probe = normSource.substring(end, end + Math.min(6, normSource.length - end));
        if (normConverted.includes(probe)) break;
        end++;
      }
      const segment = normSource.substring(i, end).trim();
      if (segment.length >= minLen) {
        missing.push(segment.substring(0, 80) + (segment.length > 80 ? '...' : ''));
      }
      i = end;
    } else {
      i = foundEnd;
    }
  }
  return missing;
}

// ============================================
// 조사·접속사 불용어 (창작 검출 제외 대상)
// ============================================
const STOPWORDS = new Set([
  '및', '등', '의', '에', '을', '를', '이', '가', '는', '은', '와', '과',
  '하여', '또는', '그리고', '하는', '한', '된', '되는', '이다', '입니다',
  '습니다', '등을', '등의', '등이'
]);

// ============================================
// 채용 도메인 보호 단어 (원문에 있으면 변환에도 반드시 존재해야 함)
// ============================================
const PROTECTED_WORDS = [
  '비상근', '상근', '정규직', '계약직', '파견직', '프리랜서', '인턴', '아르바이트',
  '일용직', '단시간', '직급', '직위', '직책', '연봉', '월급', '시급',
  '주 40시간', '주40시간', '경력', '신입', '무관'
];

// ============================================
// 템플릿 텍스트 화이트리스트 (환각 오탐 방지)
// ruleConverter.js SECTION_DEFS의 keywords와 동기화 필요
// ============================================
const TEMPLATE_WHITELIST = new Set([
  '기업소개', '회사소개', '회사개요', '기업개요', '기관소개', '법인소개', '조합소개',
  '모집부문', '모집직종', '채용분야', '모집분야', '채용직무', '모집개요', '채용개요', '모집인원',
  '담당업무', '주요업무', '직무내용', '업무내용', '수행업무', '직무소개', '업무소개', '직무기술서',
  '자격요건', '지원자격', '필수자격', '필수요건', '자격조건', '응시자격', '지원요건',
  '우대사항', '우대조건', '가점사항', '우대요건', '선호사항',
  '근무조건', '근무환경', '근무형태', '근무장소', '근무지', '근무시간', '근무처', '고용형태', '채용조건',
  '급여', '연봉', '보수', '임금', '급여조건', '처우', '보상', '연봉수준', '처우조건', '보수조건',
  '복리후생', '복지혜택', '복지제도', '사내복지', '지원제도', '사내문화',
  '전형절차', '채용절차', '선발절차', '전형과정', '채용과정', '채용프로세스', '전형방법', '전형일정',
  '접수기간', '마감일', '모집기간', '지원기간', '접수마감', '서류접수', '원서접수', '지원마감', '채용기간', '공고기간',
  '접수방법', '지원방법', '지원서접수', '제출서류', '접수처', '서류제출', '지원서류',
  '기타안내', '참고사항', '유의사항', '기타사항', '주의사항', '비고', '안내사항', '문의처', '기타문의'
]);

function isTemplateText(sentence) {
  const trimmed = enhancedNormalize(sentence).replace(/[^가-힣a-zA-Z0-9]/g, '');
  if (TEMPLATE_WHITELIST.has(trimmed)) return true;
  // "1. 기업소개", "■ 담당업무" 등 접두사 변형 허용
  for (const kw of TEMPLATE_WHITELIST) {
    if (trimmed.endsWith(kw) && trimmed.length <= kw.length + 5) return true;
  }
  return false;
}

// ============================================
// 템플릿 래퍼 텍스트 제거 (창작 검출용)
// convertedHtml의 DOM에서 템플릿 구조 요소를 제거하여 순수 콘텐츠만 남김
// ============================================
function stripTemplateWrapperText(convDom) {
  const clone = convDom.cloneNode(true);
  // 템플릿 헤더 (키비주얼, 제목, 회사명)
  clone.querySelectorAll('.templ_header').forEach(el => el.remove());
  // 스페이서 (S1: h10/h30 추가)
  clone.querySelectorAll('.h10, .h20, .h30, .h40').forEach(el => el.remove());
  // 하단 버튼 영역
  clone.querySelectorAll('.templ-bottom-btn').forEach(el => el.remove());
  // hidden input, style, link (텍스트 없지만 안전장치)
  clone.querySelectorAll('#isIncruit, style, link').forEach(el => el.remove());
  // 섹션 제목 전체 — h3 텍스트가 인접 <p>와 합성 토큰 생성 방지 (E1)
  // sec_title 내 h3는 TEMPLATE_WHITELIST 단어와 중복이므로 제거해도 진짜 환각을 놓치지 않음
  clone.querySelectorAll('.sec_title, .sec_title_icon').forEach(el => el.remove());
  return clone;
}

// ============================================
// 창작(추가 텍스트) 검출 — 변환문에만 있는 단어 추출
// build 290: 한국어 띄어쓰기 변이 흡수를 위해 substring 매칭으로 전환.
// 정확 매칭(srcWordSet.has)은 "기획 및 공간 운영" → "기획및공간운영" 같은
// 띄어쓰기 차이를 모두 false positive로 잡아 정상 변환을 F로 떨어뜨림.
// 원문 글자 시퀀스(공백 제거)에 포함되면 환각 아닌 것으로 판정.
// 환각은 V3 protectedMissing(도메인 핵심어 substring 검사)로도 별도 잡힘.
// ============================================
function detectFabricatedWords(normSource, normConverted) {
  const srcNoSpace = normSource.replace(/\s+/g, '');
  const convWords = normConverted.split(/\s+/).filter(w => w.length > 0);

  return convWords.filter(w =>
    w.length >= 2 &&
    !srcNoSpace.includes(w) &&       // 띄어쓰기 무관 substring 검사 (build 290)
    !STOPWORDS.has(w) &&
    !/^\d+$/.test(w) &&              // 숫자 전용 제외
    !isTemplateText(w)               // 템플릿 섹션 제목 제외
  );
}

// ============================================
// 로컬 사후 검증: 원문 보존 + 구조 보존 확인 (글자 + 단어 단위)
// ============================================
function verifyConversion(sourceHtml, convertedHtml) {
  const report = {
    passed: true,
    textMatch: 0,
    wordMatch: 0,
    fabricatedTexts: [],
    missingTexts: [],
    structureCheck: { tables: { source: 0, converted: 0 }, lists: { source: 0, converted: 0 } },
    criticalData: { missing: [] },
    tableDetail: { cellsMissing: [] },
    summary: ''
  };

  // --- 단일 DOM 파싱 (모든 검증에서 재사용) ---
  const srcDom = document.createElement('div');
  srcDom.innerHTML = sourceHtml;
  const convDom = document.createElement('div');
  convDom.innerHTML = convertedHtml;

  const sourceText = srcDom.textContent || '';
  const convertedText = convDom.textContent || '';

  const normSource = enhancedNormalize(sourceText);
  const normConverted = enhancedNormalize(convertedText);

  // --- 1. 글자 단위 텍스트 충실도 검증 ---
  const srcChars = Array.from(normSource);
  const convChars = Array.from(normConverted);

  let charMatch = 0;
  if (srcChars.length === 0) {
    charMatch = 100;
  } else if (srcChars.length * convChars.length <= 25000000) {
    // 글자 단위 LCS (5000자 이하 텍스트)
    const lcsLen = computeLCSLength(srcChars, convChars);
    charMatch = Math.round((lcsLen / srcChars.length) * 100);
  } else {
    // 단어 단위 LCS + 글자 가중치 (성능 보호)
    const srcW = normSource.split(/\s+/).filter(w => w.length > 0);
    const convW = normConverted.split(/\s+/).filter(w => w.length > 0);
    const wLcs = computeLCSLength(srcW, convW);
    const totalChars = srcW.reduce((sum, w) => sum + w.length, 0);
    const avg = totalChars / (srcW.length || 1);
    charMatch = Math.round((wLcs * avg / totalChars) * 100);
  }

  // --- V4. 단어 단위 LCS 추가 (이중 검증) ---
  const srcWords = normSource.split(/\s+/).filter(w => w.length > 0);
  const convWords = normConverted.split(/\s+/).filter(w => w.length > 0);
  let wordMatch = 100;
  if (srcWords.length > 0) {
    const wordLcsLen = computeLCSLength(srcWords, convWords);
    wordMatch = Math.round((wordLcsLen / srcWords.length) * 100);
  }
  report.wordMatch = wordMatch;
  // V4 패치 (build 289): 한국어 토큰 변이로 wordMatch가 정상 변환에서도 폭락하는
  // false positive 다수 발생 → 점수 계산은 charMatch만 사용. wordMatch는 리포트
  // 표시(글자 X% / 단어 Y%)로 보조 정보로만 노출.
  report.textMatch = charMatch;

  // --- V1. 창작(추가 텍스트) 검출 (역방향 비교) ---
  const strippedConvDom = stripTemplateWrapperText(convDom);
  const strippedConvText = strippedConvDom.textContent || '';
  const strippedNormConverted = enhancedNormalize(strippedConvText);
  report.fabricatedTexts = detectFabricatedWords(normSource, strippedNormConverted);

  // --- V3. 도메인 보호 단어 검증 ---
  const protectedMissing = PROTECTED_WORDS.filter(w =>
    normSource.includes(w) && !normConverted.includes(w)
  );
  report.protectedMissing = protectedMissing;

  // ★ 누락 구간 식별 — V2: 95% 일치율 스킵 제거, 항상 누락 점검
  // V5 (build 406): 퍼지 매칭 도입 — 구두점/띄어쓰기 차이나 재포맷으로 인한
  // false positive 감소. 3단계: exact → 구두점 제거 → 토큰 커버리지 85%+
  if (report.textMatch >= 85) {
    // 일치율 85% 이상: 스타일 변경과 실제 누락을 구분
    const sourceSegments = extractSourceSegments(srcDom);
    const filtered = [];
    if (sourceSegments.length > 0) {
      sourceSegments
        .filter(seg => !isSegmentPreserved(seg, normConverted))
        .forEach(seg => {
          // 너무 짧은 텍스트(2-5글자)는 필터링 (불릿 기호, 번호 등)
          if (seg.length > 5) {
            filtered.push(seg.substring(0, 80) + (seg.length > 80 ? '...' : ''));
          }
        });
    }
    report.missingTexts = filtered;
  } else {
    // 일치율 85% 미만: 모든 누락 텍스트 표시
    const sourceSegments = extractSourceSegments(srcDom);
    if (sourceSegments.length > 0) {
      report.missingTexts = sourceSegments
        .filter(seg => !isSegmentPreserved(seg, normConverted))
        .map(seg => seg.substring(0, 80) + (seg.length > 80 ? '...' : ''));
    } else {
      report.missingTexts = findMissingSegments(normSource, normConverted);
    }
  }

  // --- 2. 구조 보존 검증 (기존 DOM 재사용) ---
  const srcStruct = {
    tables: srcDom.querySelectorAll('table').length,
    lists: srcDom.querySelectorAll('ul, ol').length,
    headings: srcDom.querySelectorAll('h1, h2, h3, h4, h5, h6').length
  };
  const convStruct = {
    tables: convDom.querySelectorAll('table').length,
    lists: convDom.querySelectorAll('ul, ol').length,
    headings: convDom.querySelectorAll('h1, h2, h3, h4, h5, h6').length
  };
  report.structureCheck = {
    tables: { source: srcStruct.tables, converted: convStruct.tables },
    lists: { source: srcStruct.lists, converted: convStruct.lists },
    headings: { source: srcStruct.headings, converted: convStruct.headings }
  };

  // --- 4. 핵심 데이터 검증 (전화번호, 이메일, 금액, 날짜, URL) ---
  const patterns = {
    phone: /(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}|(?:\+82|82)[-.\s]?\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4})/g,
    email: /[\w.-]+@[\w.-]+\.\w{2,}/g,
    salary: /\d{1,3}(?:,\d{3})+\s*(?:원|만원|만\s*원)/g,
    date: /\d{4}[.\-\/년]\s*\d{1,2}[.\-\/월]\s*\d{1,2}[일]?/g,
    url: /https?:\/\/[^\s<>"']+/g
  };

  Object.entries(patterns).forEach(([type, pattern]) => {
    const sourceMatches = sourceText.match(pattern) || [];
    const convertedMatches = convertedText.match(pattern) || [];
    const typeLabel = { phone: '전화번호', email: '이메일', salary: '급여', date: '날짜', url: 'URL' }[type];

    sourceMatches.forEach(m => {
      const normalizedM = m.replace(/\s+/g, '');
      const found = convertedMatches.some(cm => cm.replace(/\s+/g, '') === normalizedM);
      if (!found) {
        report.criticalData.missing.push(`${typeLabel}: ${m}`);
      }
    });
  });

  // --- 4-b. 중첩 테이블 구조 검증 ---
  const srcNestedTables = srcDom.querySelectorAll('td table, th table').length;
  const convNestedTables = convDom.querySelectorAll('td table, th table').length;
  if (srcNestedTables > 0 && convNestedTables < srcNestedTables) {
    report.criticalData.missing.push(`중첩 테이블: 원문 ${srcNestedTables}개 → 변환 ${convNestedTables}개 (셀 안 테이블이 밖으로 빠졌을 수 있음)`);
  }

  // --- 5. 테이블 셀 내용 검증 (기존 DOM 재사용) ---
  const sourceCells = [];
  srcDom.querySelectorAll('td, th').forEach(cell => {
    const text = enhancedNormalize(cell.textContent || '').trim();
    if (text.length > 1) sourceCells.push(text);
  });
  const convertedCells = [];
  convDom.querySelectorAll('td, th').forEach(cell => {
    const text = enhancedNormalize(cell.textContent || '').trim();
    if (text.length > 1) convertedCells.push(text);
  });

  // ★ 테이블 셀 검증: 텍스트 일치율이 낮을 때만 수행 (false positive 방지)
  if (sourceCells.length > 0 && report.textMatch < 80) {
    sourceCells.forEach(cell => {
      const nc = enhancedNormalize(cell);
      // 더 유연한 비교: 60% 이상 문자 유사도 또는 주요 단어 포함 확인
      const found = convertedCells.some(cc => {
        const ncc = enhancedNormalize(cc);
        // 1. 완전 포함
        if (ncc.includes(nc) || nc.includes(ncc)) return true;
        // 2. 주요 단어(5글자 이상) 공유
        const ncWords = nc.split(/\s+/).filter(w => w.length >= 5);
        if (ncWords.length > 0) {
          return ncWords.some(word => ncc.includes(word));
        }
        return false;
      });
      if (!found) {
        report.tableDetail.cellsMissing.push(cell.substring(0, 60) + (cell.length > 60 ? '...' : ''));
      }
    });
  }

  // ★ rowspan/colspan 오류 검증
  const convTables = convDom.querySelectorAll('table');
  convTables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    const numRows = rows.length;

    // 각 행을 순회하며 rowspan 값 검증
    rows.forEach((row, rowIdx) => {
      const cells = row.querySelectorAll('td, th');
      cells.forEach(cell => {
        const rowspan = parseInt(cell.getAttribute('rowspan') || '1');
        // rowspan이 표의 높이를 초과하지 않는지 확인
        if (rowIdx + rowspan > numRows) {
          report.criticalData.missing.push(
            `rowspan 오류: 행 ${rowIdx + 1}의 셀이 rowspan="${rowspan}"이지만 표 높이는 ${numRows}행입니다 (초과됨)`
          );
        }
      });
    });
  });

  // --- 최종 판정 + 품질 등급 ---
  let deductions = 0;
  if (report.textMatch < 99) deductions += (99 - report.textMatch) * 2;    // 글자/단어 단위: 미달 %당 2점 감점
  deductions += report.criticalData.missing.length * 10;                     // 핵심 데이터 누락 1건당 10점
  deductions += report.tableDetail.cellsMissing.length * 3;                 // 테이블 셀 누락 1건당 3점
  deductions += report.fabricatedTexts.length * 5;                           // V1: 창작 단어 1개당 5점 감점

  // V3: 도메인 보호 단어 소실 → 감점 최소 45 (F 보장)
  if (protectedMissing.length > 0) {
    deductions = Math.max(deductions, 45);
    report.criticalData.missing.push(`도메인 핵심어 소실: ${protectedMissing.join(', ')}`);
  }

  // ★ 테이블 소실은 제일 심각 (무조건 F 등급)
  if (report.structureCheck.tables.source > 0 && report.structureCheck.tables.converted === 0) {
    deductions = 100; // 무조건 실패
  }
  // ★ 테이블이 많이 소실된 경우도 심각
  else if (report.structureCheck.tables.source > 0 && report.structureCheck.tables.converted < report.structureCheck.tables.source) {
    deductions += Math.abs(report.structureCheck.tables.source - report.structureCheck.tables.converted) * 25;
  }

  let score = Math.max(0, 100 - deductions);

  // V5: 창작 단어 수에 따른 등급 강제 캡
  if (report.fabricatedTexts.length >= 10) {
    score = Math.min(score, 59);   // F 강제
  } else if (report.fabricatedTexts.length >= 5) {
    score = Math.min(score, 79);   // C 이하 강제
  }

  let grade, gradeLabel, gradeIcon;
  if (score >= 95) { grade = 'A'; gradeLabel = '우수'; gradeIcon = '🟢'; }
  else if (score >= 85) { grade = 'B'; gradeLabel = '양호'; gradeIcon = '🟡'; }    // V5: B 커트라인 80→85
  else if (score >= 60) { grade = 'C'; gradeLabel = '주의'; gradeIcon = '🟠'; }
  else { grade = 'F'; gradeLabel = '실패'; gradeIcon = '🔴'; }

  report.score = score;
  report.grade = grade;
  report.passed = grade !== 'F';

  // --- 요약 메시지 생성 ---
  const lines = [];

  lines.push(`${gradeIcon} **품질 등급: ${grade} (${gradeLabel})** — 점수 ${score}/100`);
  lines.push(`텍스트 일치율: ${report.textMatch}% (글자 ${charMatch}% / 단어 ${wordMatch}%)`);

  // V6: 창작 텍스트 블록
  if (report.fabricatedTexts.length > 0) {
    lines.push(`\n⚠ **원문에 없는 텍스트 감지 (${report.fabricatedTexts.length}건)**`);
    report.fabricatedTexts.slice(0, 5).forEach(t => lines.push(`  - "${t}"`));
    if (report.fabricatedTexts.length > 5) lines.push(`  - ...외 ${report.fabricatedTexts.length - 5}건`);
  }

  // V3: 보호 단어 소실 블록
  if (protectedMissing.length > 0) {
    lines.push(`\n🔴 **채용 핵심어 소실 (${protectedMissing.length}건)**`);
    protectedMissing.forEach(w => lines.push(`  - "${w}"`));
  }

  const { tables, lists, headings } = report.structureCheck;
  if (tables.source !== tables.converted || lists.source !== lists.converted || headings.source !== headings.converted) {
    lines.push(`\n⚠ **구조 변화 감지**`);
    if (tables.source !== tables.converted) lines.push(`  - 테이블: 원문 ${tables.source}개 → 변환 ${tables.converted}개`);
    if (lists.source !== lists.converted) lines.push(`  - 리스트: 원문 ${lists.source}개 → 변환 ${lists.converted}개`);
    if (headings.source !== headings.converted) lines.push(`  - 제목: 원문 ${headings.source}개 → 변환 ${headings.converted}개`);
  }

  if (report.tableDetail.cellsMissing.length > 0) {
    lines.push(`\n⚠ **테이블 셀 누락 (${report.tableDetail.cellsMissing.length}건)**`);
    report.tableDetail.cellsMissing.slice(0, 5).forEach(t => lines.push(`  - ${t}`));
    if (report.tableDetail.cellsMissing.length > 5) lines.push(`  - ...외 ${report.tableDetail.cellsMissing.length - 5}건`);
  }

  if (report.criticalData.missing.length > 0) {
    lines.push(`\n⚠ **핵심 데이터 누락**`);
    report.criticalData.missing.forEach(m => lines.push(`  - ${m}`));
  }

  if (grade === 'A') {
    lines.push(`\n✓ 검증 통과 — 원문이 정확히 보존되었습니다.`);
  } else if (grade === 'B') {
    lines.push(`\n✓ 검증 통과 — 사소한 차이가 있지만 허용 범위입니다.`);
  } else if (grade === 'C') {
    lines.push(`\n⚠ 주의 필요 — 일부 내용이 변경되었을 수 있습니다. 확인 후 사용해주세요.`);
  } else {
    lines.push(`\n✗ 검증 실패 — 원문이 정확히 보존되지 않았습니다. 재변환을 권장합니다.`);
  }

  report.summary = lines.join('\n');

  // 디버그용 — 마지막 검증 결과를 window에 노출 (build 289)
  // 콘솔에서 window.__verifyDebug() 호출하여 즉시 진단 가능
  if (typeof window !== 'undefined') {
    window.__lastVerifyReport = report;
  }

  return report;
}

// 디버그 헬퍼 — 마지막 검증 결과의 핵심 필드를 콘솔에서 한 번에 확인 (build 289)
if (typeof window !== 'undefined') {
  window.__verifyDebug = function () {
    const r = window.__lastVerifyReport;
    if (!r) return '검증을 먼저 한 번 실행하세요 (변환 후 자동 호출됨).';
    return {
      grade: r.grade,
      score: r.score,
      textMatch: r.textMatch,            // 점수 계산에 사용된 일치율 (= charMatch)
      wordMatch: r.wordMatch,            // 보조 정보 (점수 영향 없음)
      fabricatedCount: (r.fabricatedTexts || []).length,
      fabricatedSample: (r.fabricatedTexts || []).slice(0, 20),
      protectedMissing: r.protectedMissing || [],
      criticalDataMissing: (r.criticalData && r.criticalData.missing) || [],
      missingTextsCount: (r.missingTexts || []).length,
      structure: r.structureCheck
    };
  };
}

// ============================================
// Text Diff (원문 vs 변환문 차이점 표시)
// ============================================

/**
 * 원문과 변환문의 단어 단위 차이를 계산하여 하이라이트 HTML 반환
 * LCS (Longest Common Subsequence) 알고리즘 사용
 * @returns {{ html: string, addCount: number, delCount: number, changeCount: number } | null}
 */
function computeTextDiff(sourceHtml, convertedHtml) {
  function extractText(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').trim();
  }

  const oldText = enhancedNormalize(extractText(sourceHtml));
  const newText = enhancedNormalize(extractText(convertedHtml));

  const oldWords = oldText.split(/\s+/).filter(w => w.length > 0);
  const newWords = newText.split(/\s+/).filter(w => w.length > 0);

  const m = oldWords.length;
  const n = newWords.length;

  // 텍스트가 너무 길면 diff 생략 (성능 보호)
  if (m * n > 4000000) return null;

  // LCS DP 테이블
  const dp = [];
  for (let i = 0; i <= m; i++) dp[i] = new Uint16Array(n + 1);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 역추적으로 diff 연산 목록 생성
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      ops.unshift({ type: 'same', text: oldWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', text: newWords[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'del', text: oldWords[i - 1] });
      i--;
    }
  }

  // 변경 건수
  let addCount = 0, delCount = 0;
  ops.forEach(op => {
    if (op.type === 'add') addCount++;
    if (op.type === 'del') delCount++;
  });
  if (addCount === 0 && delCount === 0) return null;

  // 인접한 같은 타입 연산을 그룹화하여 가독성 향상
  let html = '';
  let currentType = null;
  let currentTexts = [];

  function flushGroup() {
    if (currentTexts.length === 0) return;
    const joined = currentTexts.map(t => escapeHtml(t)).join(' ');
    if (currentType === 'same') {
      html += joined + ' ';
    } else if (currentType === 'add') {
      html += `<span class="diff-added">${joined}</span> `;
    } else {
      html += `<span class="diff-removed">${joined}</span> `;
    }
    currentTexts = [];
  }

  for (const op of ops) {
    if (op.type !== currentType) {
      flushGroup();
      currentType = op.type;
    }
    currentTexts.push(op.text);
  }
  flushGroup();

  return { html: html.trim(), addCount, delCount, changeCount: addCount + delCount };
}

// ============================================
// Preview & Convert
// ============================================

// 실시간 미리보기 업데이트 (변환문 편집 시 바로 반영)
let livePreviewTimer = null;
function updateLivePreview() {
  clearTimeout(livePreviewTimer);
  livePreviewTimer = setTimeout(() => {
    const sourceHtml = elements.sourceEditor.innerHTML;
    if (!sourceHtml || sourceHtml === '<br>') {
      elements.previewContent.innerHTML = `
        <div class="empty-state">
          <p>원문을 첨부하면 자동으로 변환되어 여기에 표시됩니다</p>
        </div>
      `;
      return;
    }

    // sourceEditor 내용을 직접 미리보기에 렌더링
    // (AI 변환 후에는 이미 변환된 HTML, 미변환 시 로컬 변환)
    let htmlForPreview = sourceHtml;
    if (!state.convertedHtml) {
      // 아직 AI 변환 전이면 로컬 변환
      htmlForPreview = convertSourceToHtml(sourceHtml);
    }
    state.convertedHtml = htmlForPreview;
    updatePreview();
  }, 300);
}

// ============================================
// Bullet Master Pro 변환 로직 (인크루트 표준)
// ============================================

// 인크루트 표준 태그
const INCRUIT_TAGS = `<input style="margin: 0px; padding: 0px; border: 0px currentColor; width: 0px; height: 0px; font-size: 0px;" id="isIncruit" value="Y" type="hidden">`;

// 불릿 패턴 규칙 (bullet.rules.md 전체 반영)
const bulletRules = [
  // ── 순서 없는 리스트 (ulist) ──────────────────────────
  { id: 'mid',    pattern: /^[·∙\u00B7\u2219]/,               tag: 'ul', cls: 'ulist',        remove: true },
  { id: 'bull',   pattern: /^[•\u2022]/,                       tag: 'ul', cls: 'ulist bull',   remove: true },
  { id: 'cir',    pattern: /^[○\u25CB]/,                       tag: 'ul', cls: 'ulist cir',    remove: true },
  { id: 'bcir',   pattern: /^[●\u25CF]/,                       tag: 'ul', cls: 'ulist bcir',   remove: true },
  { id: 'scir',   pattern: /^[◦\u25E6]/,                       tag: 'ul', cls: 'ulist scir',   remove: true },
  { id: 'dbcir',  pattern: /^[◉\u25C9]/,                       tag: 'ul', cls: 'ulist dbcir',  remove: true },
  { id: 'ecir',   pattern: /^[◎\u25CE]/,                       tag: 'ul', cls: 'ulist ecir',   remove: true },
  { id: 'wcc',    pattern: /^[❍\u274D]/,                       tag: 'ul', cls: 'ulist wcc',    remove: true },
  { id: 'sq',     pattern: /^[□\u25A1]/,                       tag: 'ul', cls: 'ulist sq',     remove: true },
  { id: 'bsq',    pattern: /^[■\u25A0]/,                       tag: 'ul', cls: 'ulist bsq',    remove: true },
  { id: 'wsq',    pattern: /^[❏\u274F]/,                       tag: 'ul', cls: 'ulist wsq',    remove: true },
  { id: 'dbsq',   pattern: /^[▣\u25A3]/,                       tag: 'ul', cls: 'ulist dbsq',   remove: true },
  { id: 'dia',    pattern: /^[◇\u25C7]/,                       tag: 'ul', cls: 'ulist dia',    remove: true },
  { id: 'bkdia',  pattern: /^[◆\u25C6]/,                       tag: 'ul', cls: 'ulist bkdia',  remove: true },
  { id: 'dbdia',  pattern: /^[◈\u25C8]/,                       tag: 'ul', cls: 'ulist dbdia',  remove: true },
  { id: 'stri',   pattern: /^[▸\u25B8]/,                       tag: 'ul', cls: 'ulist stri',   remove: true },
  { id: 'rarro',  pattern: /^[→\u2192]/,                       tag: 'ul', cls: 'ulist rarro',  remove: true },
  { id: 'finger', pattern: /^[☞\u261E]/,                       tag: 'ul', cls: 'ulist finger', remove: true },
  { id: 'check',  pattern: /^[✓✔\u2713\u2714]/,               tag: 'ul', cls: 'ulist check',  remove: true },
  { id: 'dash',   pattern: /^[-\u2013\u2014]/,                 tag: 'ul', cls: 'ulist dash',   remove: true, isSecondary: true },
  { id: 'star',   pattern: /^\*/,                               tag: 'ul', cls: 'ulist star',   remove: true, isSecondary: true },
  { id: 'noti',   pattern: /^[※\u203B]/,                       tag: 'ul', cls: 'ulist noti',   remove: true, isSecondary: true },
  // ── 순서 있는 리스트 (olist) ──────────────────────────
  { id: 'olnum',     pattern: /^\d{1,4}(?:\s*의\s*\d{1,4})?\.(?!\s*(?:\d+[\.\s$월일~~\-\(\)\[\]]|[\(\[].*[월화수목금토일].*[\)\]]))/, tag: 'ol', cls: 'olist olnum',     remove: true },
  { id: 'olhbrac',   pattern: /^\d+\)/,                         tag: 'ol', cls: 'olist olhbrac',   remove: true },
  { id: 'olbracket', pattern: /^\(\d+\)/,                       tag: 'ol', cls: 'olist olbracket', remove: true },
  { id: 'olcir',     pattern: /^[①-⑳\u2460-\u2473]/,          tag: 'ol', cls: 'olist olcir',     remove: true },
  { id: 'kolist',    pattern: /^[가-힣]\./,                     tag: 'ol', cls: 'olist kolist',    remove: true },
  { id: 'kohbrac',   pattern: /^[가-힣]\)/,                     tag: 'ol', cls: 'olist kohbrac',   remove: true },
  { id: 'kofbrac',   pattern: /^\([가-힣]\)/,                   tag: 'ol', cls: 'olist kofbrac',   remove: true },
  { id: 'kofcir',    pattern: /^[㉮-㉻]/,                      tag: 'ol', cls: 'olist kofcir',    remove: true },
  { id: 'kocir',     pattern: /^[㉠-㉯]/,                      tag: 'ol', cls: 'olist kocir',     remove: true },
  { id: 'kobrac',    pattern: /^[㈀-㈜]/,                      tag: 'ol', cls: 'olist kobrac',    remove: true },
  { id: 'encir',     pattern: /^[ⓐ-ⓩ\u24D0-\u24E9]/,         tag: 'ol', cls: 'olist encir',     remove: true },
  { id: 'enbrac',    pattern: /^[⒜-⒵\u249C-\u24B5]/,         tag: 'ol', cls: 'olist enbrac',    remove: true },
];

// 텍스트 노드에서 불릿 패턴 삭제
function removeBulletFromNode(n, pattern) {
  if (n.nodeType === 3) {
    const t = n.textContent;
    const sIdx = t.search(/\S/);
    if (sIdx !== -1) {
      const post = t.substring(sIdx);
      const match = post.match(pattern);
      if (match) {
        n.textContent = t.substring(0, sIdx) + post.replace(match[0], '').trimStart();
        return true;
      }
    }
  }
  for (let child of n.childNodes) {
    if (removeBulletFromNode(child, pattern)) return true;
  }
  return false;
}

// 컨테이너에 그룹화 적용
function applyGroupToContainer(container) {
  const children = [];

  function flatten(node) {
    const tagName = node.nodeType === 1 ? node.tagName.toLowerCase() : '';
    if (tagName === 'ul' || tagName === 'ol' || tagName === 'dl') {
      let ruleId = null;
      const classList = Array.from(node.classList);
      for (let r of bulletRules) {
        if (classList.includes(r.id)) { ruleId = r.id; break; }
      }
      Array.from(node.childNodes).forEach(child => {
        const childTag = child.nodeType === 1 ? child.tagName.toLowerCase() : '';
        if (childTag === 'li' || childTag === 'dd' || childTag === 'dt') {
          const contentClone = child.cloneNode(true);
          const nestedLists = Array.from(contentClone.querySelectorAll('ul, ol, dl'));
          nestedLists.forEach(nl => nl.remove());
          if (contentClone.textContent.trim() || contentClone.querySelector('img, sup, sub, strong, em, span')) {
            contentClone.setAttribute('data-original-tag', tagName);
            contentClone.setAttribute('data-original-class', node.className);
            if (ruleId) contentClone.setAttribute('data-source-rule', ruleId);
            children.push(contentClone);
          }
          nestedLists.forEach(nl => flatten(nl));
        } else if (childTag === 'ul' || childTag === 'ol' || childTag === 'dl') {
          flatten(child);
        } else {
          if (child.nodeType === 1 || (child.nodeType === 3 && child.textContent.trim())) {
            children.push(child.cloneNode(true));
          }
        }
      });
    } else {
      children.push(node.cloneNode(true));
    }
  }

  Array.from(container.childNodes).forEach(node => flatten(node));
  if (children.length === 0) return;

  const fragment = document.createDocumentFragment();
  let currentList = null, currentId = null, lastLi = null;
  let currentSubList = null, currentSubId = null;
  let pendingNodes = [], isAtStartOfLine = true;

  children.forEach(node => {
    const tagName = node.nodeType === 1 ? node.tagName.toLowerCase() : '';
    const isIgnorable = (node.nodeType === 3 && !node.textContent.trim()) ||
      tagName === 'br' || (tagName === 'div' && (node.className.includes('h') || !node.textContent.trim()));

    if (isIgnorable) {
      if (tagName === 'br' || (tagName === 'div' && node.className.includes('h'))) isAtStartOfLine = true;
      if (currentList) pendingNodes.push(node.cloneNode(true));
      else fragment.appendChild(node.cloneNode(true));
      return;
    }

    const text = node.textContent.trim();
    let matchedRule = null;
    const isSupExclusion = (node.nodeType === 1 && node.innerHTML.trim().toLowerCase().startsWith('<sup'));

    if (!isSupExclusion) {
      const isOriginallyListItem = (node.nodeType === 1 && (tagName === 'li' || tagName === 'dd'));
      if (isAtStartOfLine || isOriginallyListItem) {
        for (let rule of bulletRules) {
          if (rule.pattern.test(text)) {
            const isCell = container.tagName === 'TD' || container.tagName === 'TH';
            if (isCell && rule.remove && !text.replace(rule.pattern, '').trim()) continue;
            matchedRule = rule;
            break;
          }
        }
      }
    }

    if (!matchedRule) {
      const sourceRuleId = (node.nodeType === 1) ? node.getAttribute('data-source-rule') : null;
      if (sourceRuleId) matchedRule = bulletRules.find(r => r.id === sourceRuleId);
    }

    if (!matchedRule && node.nodeType === 1 && (tagName === 'li' || tagName === 'dd')) {
      const origTag = node.getAttribute('data-original-tag') || (tagName === 'dd' ? 'dl' : 'ul');
      const origClass = node.getAttribute('data-original-class') || '';
      const isOriginallySecondary = /star|dash|noti/.test(origClass);
      matchedRule = {
        id: 'restored-' + (isOriginallySecondary ? 'sec-' : '') + origClass.replace(/\s+/g, '-'),
        tag: origTag, cls: origClass || 'ulist', remove: false, isSecondary: isOriginallySecondary
      };
    }

    if (matchedRule) {
      if (matchedRule.isSecondary && lastLi && matchedRule.id !== currentId) {
        if (!currentSubList || currentSubId !== matchedRule.id) {
          pendingNodes = [];
          currentSubList = document.createElement(matchedRule.tag);
          currentSubList.className = matchedRule.cls;
          lastLi.appendChild(currentSubList);
          currentSubId = matchedRule.id;
        }
        const li = document.createElement(matchedRule.tag === 'dl' ? 'dd' : 'li');
        li.innerHTML = (node.nodeType === 1) ? node.innerHTML : node.textContent;
        if (matchedRule.remove) removeBulletFromNode(li, matchedRule.pattern);
        currentSubList.appendChild(li);
        pendingNodes = [];
      } else {
        if (!currentList || currentId !== matchedRule.id) {
          pendingNodes.forEach(pn => fragment.appendChild(pn));
          pendingNodes = [];
          currentList = document.createElement(matchedRule.tag);
          currentList.className = matchedRule.cls;
          fragment.appendChild(currentList);
          currentId = matchedRule.id;
        } else { pendingNodes = []; }
        const li = document.createElement(matchedRule.tag === 'dl' ? 'dd' : 'li');
        li.innerHTML = (node.nodeType === 1) ? node.innerHTML : node.textContent;
        if (matchedRule.remove) removeBulletFromNode(li, matchedRule.pattern);
        currentList.appendChild(li);
        lastLi = li;
        currentSubList = null; currentSubId = null;
      }
      isAtStartOfLine = true;
    } else {
      pendingNodes.forEach(pn => fragment.appendChild(pn));
      pendingNodes = [];
      currentList = null; currentId = null; lastLi = null;
      currentSubList = null; currentSubId = null;
      fragment.appendChild(node.cloneNode(true));
      isAtStartOfLine = false;
    }
  });

  pendingNodes.forEach(pn => fragment.appendChild(pn));
  container.innerHTML = '';
  container.appendChild(fragment);
}

// 원문 HTML을 인크루트 표준 HTML로 변환
function convertSourceToHtml(sourceHtml) {
  // DOMPurify로 정제 (사용 가능한 경우)
  const cleanHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(sourceHtml) : sourceHtml;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${cleanHtml}</body>`, 'text/html');

  // 기존 인크루트 태그 제거
  doc.querySelectorAll('#isIncruit, link[href*="incru.it"]').forEach(el => el.remove());

  // style 태그 추출
  const styles = Array.from(doc.querySelectorAll('style')).map(s => s.outerHTML).join('\n');
  doc.querySelectorAll('style').forEach(s => s.remove());

  // 모든 컨테이너에 변환 적용
  const containers = Array.from(doc.querySelectorAll('body, td, th, div, li, p')).reverse();
  containers.forEach(container => applyGroupToContainer(container));

  // UL/OL 클래스 보강 + 서브클래스 없는 리스트는 내용 기반 재분류 + 불릿 기호 제거
  doc.querySelectorAll('ul, ol').forEach(list => {
    const tag = list.tagName.toLowerCase();
    const cls = tag === 'ul' ? 'ulist' : 'olist';
    if (!list.classList.contains(cls)) list.classList.add(cls);

    // 서브클래스 없이 ulist/olist 하나만 있으면 내용 기반 재분류
    const hasOnlyBase = list.classList.length === 1 && list.classList.contains(cls);
    if (hasOnlyBase) {
      const firstLi = list.querySelector('li');
      if (firstLi) {
        const liText = firstLi.textContent.trim();
        for (const rule of bulletRules) {
          if (rule.tag === tag && rule.pattern.test(liText)) {
            list.className = rule.cls;
            break;
          }
        }
      }
    }

    // 모든 li에서 불릿 기호 제거
    list.querySelectorAll('li').forEach(li => {
      const liText = li.textContent.trim();
      for (let rule of bulletRules) {
        if (rule.remove && rule.pattern.test(liText)) {
          removeBulletFromNode(li, rule.pattern);
          break;
        }
      }
    });
  });

  // 최종 HTML 조합
  const finalHtml = doc.body.innerHTML + '\n' + INCRUIT_TAGS + (styles ? '\n' + styles : '');
  return finalHtml;
}

/**
 * v3 템플릿 섹션 구조 변환
 * AI가 생성한 <h2> 헤딩 + 콘텐츠를 v3 섹션 구조(.sec_wrap)로 변환.
 * 헤딩 텍스트의 선행 번호(1., 2. 등)는 CSS 아이콘과 중복되므로 자동 제거.
 */
/**
 * 타이틀 스타일에 따라 sec_title_wrap HTML 생성 (미리보기 + 다운로드 공통)
 */
function buildSectionTitleHtml(titleHtml, secNum) {
  let titleWrapClass, iconHtml, h3Html;

  if (state.titleStyle === 'iconNumber') {
    titleWrapClass = 'sec_title_wrap title_bg title_num';
    iconHtml = `<span class="sec_title_icon"><span class="num${parseInt(state.iconNumber) || 1}"></span></span>`;
    h3Html = `<h3>${titleHtml}</h3>`;
  } else if (state.titleStyle === 'titleSub') {
    titleWrapClass = `sec_title_wrap c_title_wrap c_title_${state.titleSub}`;
    iconHtml = '<span class="sec_title_icon"></span>';
    if (['4', '6'].includes(state.titleSub)) {
      h3Html = `<h3><span class="title_num">${secNum}</span>${titleHtml}</h3>`;
    } else {
      h3Html = `<h3>${secNum}. ${titleHtml}</h3>`;
    }
  } else {
    // iconBg (기본값)
    titleWrapClass = 'sec_title_wrap title_bg';
    iconHtml = `<span class="sec_title_icon"><span class="bul_${state.iconBg}"></span></span>`;
    h3Html = `<h3>${titleHtml}</h3>`;
  }

  return { titleWrapClass, innerHTML: `${iconHtml}\n        <div class="sec_title">${h3Html}</div>` };
}

/**
 * sec_box 내 테이블 첫 행이 섹션 타이틀과 동일한 단일 셀이면 제거.
 * AI가 섹션 제목을 h2 + 표 첫행에 중복 생성하는 패턴 방지용.
 */
function removeDuplicateTitleRow(secBox, titleText) {
  const normalize = t => t.replace(/\s+/g, '').toLowerCase();
  const normTitle = normalize(titleText);
  if (!normTitle) return;

  secBox.querySelectorAll('table').forEach(table => {
    const tbody = table.querySelector('tbody') || table;
    const firstRow = tbody.querySelector('tr');
    if (!firstRow) return;
    const cells = firstRow.querySelectorAll('td, th');
    if (cells.length !== 1) return;
    if (normalize(cells[0].textContent) !== normTitle) return;

    firstRow.remove();
    // 행 제거 후 표가 완전히 비었으면 .table_x wrapper째 제거
    if (!tbody.querySelector('tr')) {
      const wrapper = table.closest('.table_x') || table;
      wrapper.remove();
    }
  });
}

function wrapInV3Sections() {
  const container = elements.previewContent;
  if (!container) return;

  const templContent = container.querySelector('.templ_content');
  if (!templContent) return;

  // h1은 공고 제목 — 섹션 변환 대상 아님
  // data-hr-property 래퍼 안의 h2를 기준으로 섹션 분리
  const hrSections = templContent.querySelectorAll('[data-hr-property]');
  let secNum = 0;

  if (hrSections.length > 0) {
    // Case 1: AI가 data-hr-property 래퍼를 생성한 경우
    hrSections.forEach(section => {
      const h2 = section.querySelector('h2');
      if (!h2) return;
      secNum++;

      // 선행 번호·불릿 제거: "1. 모집현황" → "모집현황", "■ 채용개요" → "채용개요"
      const titleHtml = h2.innerHTML
        .replace(/^\s*\d+\s*[.．·]\s*/, '')
        .replace(/^\s*[○●◦◉◎❍□■❏▣◇◆◈▸→☞✓✔·∙•※*\u2022\u203B\u25CB\u25CF\u25E6\u25C9\u25CE\u274D\u25A1\u25A0\u274F\u25A3\u25C7\u25C6\u25C8\u25B8\u2192\u261E\u2713\u2714\u00B7\u2219]\s*/, '');

      // sec_wrap 생성
      const secWrap = document.createElement('div');
      secWrap.className = `sec_wrap sec${secNum}`;
      // data 속성 보존
      for (const attr of section.attributes) {
        if (attr.name.startsWith('data-')) {
          secWrap.setAttribute(attr.name, attr.value);
        }
      }

      // 제목 영역 — state.titleStyle 반영
      const titleInfo = buildSectionTitleHtml(titleHtml, secNum);
      const titleWrap = document.createElement('div');
      titleWrap.className = titleInfo.titleWrapClass;
      titleWrap.innerHTML = titleInfo.innerHTML;

      // 콘텐츠 영역
      const secBox = document.createElement('div');
      secBox.className = 'sec_box';
      Array.from(section.children).forEach(child => {
        if (child !== h2) secBox.appendChild(child);
      });
      removeDuplicateTitleRow(secBox, h2.textContent);

      secWrap.appendChild(titleWrap);
      secWrap.appendChild(secBox);

      // 간격
      const spacer = document.createElement('div');
      spacer.className = 'h40';

      section.parentNode.insertBefore(secWrap, section);
      section.parentNode.insertBefore(spacer, secWrap.nextSibling);
      section.remove();
    });
  } else {
    // Case 2: 단독 <h2> 헤딩 (data-hr-property 없음)
    const headings = Array.from(templContent.querySelectorAll('h2'));
    headings.forEach(h2 => {
      secNum++;

      const titleHtml = h2.innerHTML
        .replace(/^\s*\d+\s*[.．·]\s*/, '')
        .replace(/^\s*[○●◦◉◎❍□■❏▣◇◆◈▸→☞✓✔·∙•※*\u2022\u203B\u25CB\u25CF\u25E6\u25C9\u25CE\u274D\u25A1\u25A0\u274F\u25A3\u25C7\u25C6\u25C8\u25B8\u2192\u261E\u2713\u2714\u00B7\u2219]\s*/, '');

      const secWrap = document.createElement('div');
      secWrap.className = `sec_wrap sec${secNum}`;

      // 제목 영역 — state.titleStyle 반영
      const titleInfo = buildSectionTitleHtml(titleHtml, secNum);
      const titleWrap = document.createElement('div');
      titleWrap.className = titleInfo.titleWrapClass;
      titleWrap.innerHTML = titleInfo.innerHTML;

      const secBox = document.createElement('div');
      secBox.className = 'sec_box';

      // h2 다음 형제들을 다음 h2 또는 끝까지 수집
      let sibling = h2.nextElementSibling;
      while (sibling && sibling.tagName !== 'H2') {
        const next = sibling.nextElementSibling;
        secBox.appendChild(sibling);
        sibling = next;
      }
      removeDuplicateTitleRow(secBox, h2.textContent);

      secWrap.appendChild(titleWrap);
      secWrap.appendChild(secBox);

      const spacer = document.createElement('div');
      spacer.className = 'h40';

      h2.parentNode.insertBefore(secWrap, h2);
      h2.parentNode.insertBefore(spacer, secWrap.nextSibling);
      h2.remove();
    });
  }
}

/**
 * 미리보기 <li> 이중 마커 제거
 * AI 변환 시 원문 마커(○, ※, 가. 등)가 텍스트로 보존된 경우,
 * CSS ::before 마커와 중복되므로 CSS 마커를 숨기는 has-marker 클래스를 부여한다.
 */
function fixDoubleMarkers() {
  const container = elements.previewContent;
  if (!container) return;

  const MARKER_RE = /^\s*(?:[○●■□▶▷★☆※•◆◇▪◎▣☐☑▲△►▻·\u2022\u2023\u2043]|[\u2460-\u249B]|[\u326E-\u327B]|[\u3280-\u32B0]|\(\d{1,3}\)\s|\d{1,3}\.\s|[가-힣][.)]\s)/;

  container.querySelectorAll('li').forEach(li => {
    const parentUl = li.closest('ul');
    const isNoti = parentUl && parentUl.classList.contains('noti');
    const text = li.textContent.trimStart();
    if (!text) return;
    if (isNoti) {
      // noti 리스트: ※ 기호만 텍스트에서 제거, has-marker 부여 안 함
      if (/^\s*[※\u203B]\s*/.test(text)) {
        li.innerHTML = li.innerHTML.replace(/^\s*[※\u203B]\s*/, '');
      }
    } else if (MARKER_RE.test(text)) {
      // ulist/olist 스타일 클래스가 있으면 CSS ::before 마커 사용 → has-marker 불필요
      const hasExplicitStyle = parentUl && (parentUl.classList.contains('ulist') || parentUl.classList.contains('olist'));
      if (!hasExplicitStyle) {
        li.classList.add('has-marker');
        li.style.listStyle = 'none';
      }
    }
  });

  // 한글 불릿 사용 시 h2 제목에서 중복 아라비아 숫자 제거
  // 예: "일. 1.채용분야및 인원" → "일. 채용분야및 인원"
  const bulletStyle = state.bulletStyle;
  if (bulletStyle === 'hangul') {
    container.querySelectorAll('h2').forEach(h2 => {
      // innerHTML을 사용하여 구조를 유지하면서 숫자만 제거
      let html = h2.innerHTML;
      // 여러 패턴의 선행 숫자 제거: "1.", "1)", "1 ", "①" 등
      const patterns = [
        /^\s*\d{1,3}\.\s*/,           // "1. ", "10. " 등
        /^\s*\d{1,3}\)\s*/,           // "1) ", "10) " 등
        /^\s*\d{1,3}\s+/,             // "1 ", "10 " 등
        /^\s*[\u2460-\u2473][.)]?\s*/,     // ①②③ 등 원형 숫자 (①. ①) 포함)
        /^\s*[\u2776-\u277F][.)]?\s*/,     // ➀➁➂ 등
        /^\s*[\u3251-\u325F][.)]?\s*/,     // ㉑㉒㉓ 등
        /^\s*[\u3280-\u32B0][.)]?\s*/      // ㈀㈁㈂ 등
      ];

      let cleaned = html;
      for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, '');
        if (cleaned !== html) break; // 하나라도 매칭되면 중단
      }

      if (cleaned !== html) {
        h2.innerHTML = cleaned;
      }
    });
  }
}

/**
 * 한국 법률 "N의M" 번호 후처리
 * Phase 1: 원문에서 "N의M." 패턴 추출 → AI가 빠뜨린 경우 DOM에 복원
 * Phase 2: DOM에서 "N의M." 감지 → CSS 번호 비활성화 + 들여쓰기 + 순번
 */
function fixLegalSubNumbering() {
  const container = elements.previewContent;
  if (!container) return;

  const SUB_NUM_RE = /^\s*\d+의\s?\d+\.\s/;

  // Phase 1: 원문에서 "N의M." 패턴 추출 → AI 누락분 복원
  // 3단계 fallback: state → localStorage → originalSource
  let entries = state.legalSubNumbers || [];
  if (entries.length === 0) {
    try {
      const stored = localStorage.getItem(wsKey('legal_sub_numbers'));
      if (stored) entries = JSON.parse(stored);
    } catch {}
  }
  if (entries.length === 0) {
    const srcHtml = state.originalSource?.html || '';
    if (srcHtml) {
      const tmp = document.createElement('div');
      tmp.innerHTML = srcHtml;
      const plain = tmp.textContent || '';
      const re = /(\d+)의\s?(\d+)\.\s*(.{0,40})/g;
      let m;
      while ((m = re.exec(plain)) !== null) {
        entries.push({
          prefix: `${m[1]}의${m[2]}.`,
          snippet: m[3].trim().substring(0, 15)
        });
      }
    }
  }

  // entries 기반 인덱스 매칭
  if (entries.length > 0) {
    const groups = {};
    for (const entry of entries) {
      const m = entry.prefix.match(/^(\d+)의(\d+)\.$/);
      if (m) {
        const parent = parseInt(m[1]);
        if (!groups[parent]) groups[parent] = [];
        groups[parent].push(entry);
      }
    }

    container.querySelectorAll('ol').forEach(ol => {
      const items = Array.from(ol.querySelectorAll(':scope > li'));
      if (items.length < 3) return;

      for (const [parentStr, subEntries] of Object.entries(groups)) {
        const parent = parseInt(parentStr);
        for (let i = 0; i < subEntries.length; i++) {
          const targetIdx = parent + i;
          if (targetIdx >= items.length) break;
          const li = items[targetIdx];
          const directText = getDirectText(li);
          if (SUB_NUM_RE.test(directText)) continue;

          const firstNode = li.childNodes[0];
          if (firstNode && firstNode.nodeType === 3) {
            firstNode.textContent = subEntries[i].prefix + ' ' + firstNode.textContent.replace(/^\s*/, '');
          } else {
            li.insertBefore(document.createTextNode(subEntries[i].prefix + ' '), li.firstChild);
          }
          li.removeAttribute('set');
          li.removeAttribute('value');
        }
      }
    });
  }

  // Phase 1b: 원본 또는 변환된 DOM에 "N의M" 패턴이 있을 때만 DOM 구조 추론
  // 오탐 방지: 일반 중첩 리스트(li 안에 ol)는 처리 안 함
  let hasLegalSubAnywhere = entries.length > 0;
  if (!hasLegalSubAnywhere) {
    // 1) 원본 소스 체크
    const srcCandidates = [
      state.sourceContent || '',
      state.originalSource?.html || '',
      elements.sourceEditor?.innerHTML || ''
    ];
    for (const src of srcCandidates) {
      if (src && /\d+의\s?\d+\./.test(src)) { hasLegalSubAnywhere = true; break; }
    }
    // 2) 변환된 DOM 체크 (텍스트에 직접 N의M이 있는지)
    if (!hasLegalSubAnywhere) {
      const previewText = container.textContent || '';
      if (/\d+의\s?\d+\./.test(previewText)) hasLegalSubAnywhere = true;
    }
  }

  if (hasLegalSubAnywhere) {
    container.querySelectorAll('ol').forEach(ol => {
      if (ol.closest('.legal-manual-num')) return;
      const items = Array.from(ol.querySelectorAll(':scope > li'));
      if (items.length < 3) return;

      // 하위 <ol>이 있으면서 "N의M." 텍스트가 없는 연속 <li> 찾기
      let subNumRun = [];
      for (let i = 0; i < items.length; i++) {
        const li = items[i];
        const hasSubList = li.querySelector(':scope > ol, :scope > ul');
        const directText = getDirectText(li);
        if (hasSubList && !SUB_NUM_RE.test(directText)) {
          subNumRun.push(i);
        } else if (subNumRun.length > 0) {
          break;
        }
      }

      if (subNumRun.length >= 1 && subNumRun[0] > 0) {
        const parentNum = subNumRun[0];
        for (let i = 0; i < subNumRun.length; i++) {
          const li = items[subNumRun[i]];
          const directText = getDirectText(li);
          if (SUB_NUM_RE.test(directText)) continue;
          const prefix = `${parentNum}의${i + 1}.`;
          const firstNode = li.childNodes[0];
          if (firstNode && firstNode.nodeType === 3) {
            firstNode.textContent = prefix + ' ' + firstNode.textContent.replace(/^\s*/, '');
          } else {
            li.insertBefore(document.createTextNode(prefix + ' '), li.firstChild);
          }
          li.removeAttribute('set');
          li.removeAttribute('value');
        }
      }
    });
  }

  // Phase 2: DOM에서 "N의M." 감지 → CSS 번호 끄기 + 들여쓰기 + 순번
  container.querySelectorAll('ol').forEach(ol => {
    const items = Array.from(ol.querySelectorAll(':scope > li'));
    const hasSubNum = items.some(li => SUB_NUM_RE.test(getDirectText(li)));
    if (!hasSubNum) return;

    ol.classList.add('legal-manual-num');

    let expectedNum = 1;
    items.forEach(li => {
      const text = getDirectText(li);
      const subMatch = text.match(/^\s*(\d+)의\s?\d+\./);
      const numMatch = text.match(/^\s*(\d+)\.\s/);

      if (subMatch) {
        // "N의M" 항목: 들여쓰기 + hanging indent 클래스 부여
        li.classList.add('legal-sub-item');
      } else if (numMatch) {
        expectedNum = parseInt(numMatch[1]) + 1;
      } else {
        const firstNode = li.childNodes[0];
        if (firstNode && firstNode.nodeType === 3) {
          firstNode.textContent = expectedNum + '. ' + firstNode.textContent.replace(/^\s*/, '');
        } else {
          li.insertBefore(document.createTextNode(expectedNum + '. '), li.firstChild);
        }
        expectedNum++;
      }
    });
  });
}

/**
 * AI가 번호 리스트를 <p> 평문으로 출력한 경우 → <ol>/<li> 구조로 변환
 * 예: <p>1. 첫번째\n2. 두번째\n가. 하위</p> → <ol><li>...</li></ol>
 */
function fixPlainTextNumberedList() {
  const container = elements.previewContent;
  if (!container) return;

  // 번호 패턴: "1." "2." ... "가." "나." ... "6의1." 등
  const NUM_LINE_RE = /^(\d+(?:의\s?\d+)?)\.\s+(.+)/;
  const KO_LINE_RE = /^([가-힣])\.\s+(.+)/;

  // === 모드 1: 단일 <p> 안에 번호 여러 개 ===
  container.querySelectorAll('p').forEach(p => {
    const text = p.textContent || '';
    const numMatches = text.match(/\d+\.\s+\S/g);
    if (!numMatches || numMatches.length < 3) return;

    const rawHtml = p.innerHTML;
    const lines = rawHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n')
      .map(l => l.replace(/<[^>]*>/g, '').trim())
      .filter(l => l.length > 0);

    if (lines.length < 3) return;
    _convertLinesToOl(lines, p);
  });

  // === 모드 2: 연속 <p> 태그가 각각 번호로 시작 ===
  // AI가 항목별로 별도 <p>를 생성한 경우 (예: <p>1. 내용</p><p>2. 내용</p>...)
  const allPs = Array.from(container.querySelectorAll('p'));
  let i = 0;
  while (i < allPs.length) {
    const p = allPs[i];
    const text = (p.textContent || '').trim();
    if (!NUM_LINE_RE.test(text)) { i++; continue; }

    // 연속된 번호 <p> 수집
    const run = [p];
    let j = i + 1;
    while (j < allPs.length) {
      const nextP = allPs[j];
      // 다음 <p>가 현재 <p>의 바로 다음 형제인지 확인 (사이에 다른 블록 요소 없어야)
      let nextSibling = run[run.length - 1].nextElementSibling;
      if (nextSibling !== nextP) break;
      const nextText = (nextP.textContent || '').trim();
      if (NUM_LINE_RE.test(nextText) || KO_LINE_RE.test(nextText)) {
        run.push(nextP);
        j++;
      } else {
        break;
      }
    }

    if (run.length >= 3) {
      const lines = run.map(rp => (rp.textContent || '').trim());
      _convertLinesToOl(lines, run[0]);
      // 나머지 <p> 제거
      for (let k = 1; k < run.length; k++) {
        run[k].remove();
      }
      i = j;
    } else {
      i++;
    }
  }
}

/** 텍스트 줄 배열을 <ol>/<li>로 변환하여 referenceEl 위치에 삽입 */
function _convertLinesToOl(lines, referenceEl) {
  const NUM_LINE_RE = /^(\d+(?:의\s?\d+)?)\.\s+(.+)/;
  const KO_LINE_RE = /^([가-힣])\.\s+(.+)/;

  let headerText = '';
  let startIdx = 0;
  if (!NUM_LINE_RE.test(lines[0]) && !KO_LINE_RE.test(lines[0])) {
    headerText = lines[0];
    startIdx = 1;
  }

  const items = [];
  let currentItem = null;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const numMatch = line.match(NUM_LINE_RE);
    const koMatch = line.match(KO_LINE_RE);

    if (numMatch) {
      if (currentItem) items.push(currentItem);
      currentItem = { num: numMatch[1], text: numMatch[2], subItems: [] };
    } else if (koMatch && currentItem) {
      currentItem.subItems.push({ marker: koMatch[1], text: koMatch[2] });
    } else if (currentItem) {
      currentItem.text += ' ' + line;
    }
  }
  if (currentItem) items.push(currentItem);

  if (items.length < 3) return;

  let html = '';
  if (headerText) {
    html += `<p>${headerText}</p>\n`;
  }
  html += '<ol class="olist olnum">\n';
  for (const item of items) {
    html += `  <li>${item.num}. ${item.text}`;
    if (item.subItems.length > 0) {
      html += '\n    <ol class="olist kolist">\n';
      for (const sub of item.subItems) {
        html += `      <li>${sub.marker}. ${sub.text}</li>\n`;
      }
      html += '    </ol>\n  ';
    }
    html += '</li>\n';
  }
  html += '</ol>';

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  while (wrapper.firstChild) {
    referenceEl.parentNode.insertBefore(wrapper.firstChild, referenceEl);
  }
  referenceEl.remove();
}

/** <li>의 직접 텍스트만 추출 (자식 <ol>/<ul> 텍스트 제외) */
function getDirectText(li) {
  let text = '';
  for (const node of li.childNodes) {
    if (node.nodeType === 3) text += node.textContent;
    else if (node.nodeType === 1 && !['OL', 'UL'].includes(node.tagName)) text += node.textContent;
    else break;
  }
  return text.trimStart();
}

/**
 * 가운뎃점(·) 복원 후처리
 * 1단계: 알려진 깨짐 문자 직접 치환 (UTF-8→EUC-KR 오독 패턴)
 * 2단계: 원문 컨텍스트 기반 복원
 */
function fixMiddleDots() {
  const container = elements.previewContent;
  if (!container) return;

  // === 1단계: 알려진 깨짐 패턴 직접 치환 ===
  // "·" (U+00B7) UTF-8 바이트 0xC2,0xB7 → EUC-KR 오독 시 "틀" (U+D2C0)
  // "한글틀한글" → "한글·한글" (틀이 한글 사이에서 가운뎃점이 아닌 경우)
  const GARBLED_DOTS = ['\u{D2C0}']; // 틀 — UTF-8 0xC2B7의 EUC-KR 오독

  const walker1 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes1 = [];
  let n1;
  while ((n1 = walker1.nextNode())) textNodes1.push(n1);

  for (const tn of textNodes1) {
    let text = tn.textContent;
    let changed = false;

    for (const garbled of GARBLED_DOTS) {
      // "한글 + 깨진문자 + 한글" 패턴에서만 치환 (오탐 방지)
      const re = new RegExp('([가-힣])' + garbled + '([가-힣])', 'g');
      if (re.test(text)) {
        text = text.replace(re, '$1·$2');
        changed = true;
      }
    }
    if (changed) tn.textContent = text;
  }

  // === 2단계: 원문 컨텍스트 기반 복원 ===
  const srcHtml = state.originalSource?.html || state.sourceContent || elements.sourceEditor?.innerHTML || '';
  if (!srcHtml) return;

  const srcTmp = document.createElement('div');
  srcTmp.innerHTML = srcHtml;
  const srcText = srcTmp.textContent || '';

  // 원문에서 "한글·한글" 패턴 추출 (다양한 중간점 변형 포함)
  const DOT_RE = /([가-힣]{1,10})[·\u00B7\u318D\u2022\u30FB]([가-힣]{1,10})/g;
  const dotPairs = [];
  let m;
  while ((m = DOT_RE.exec(srcText)) !== null) {
    dotPairs.push({ left: m[1], right: m[2] });
  }

  if (dotPairs.length === 0) return;

  const walker2 = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes2 = [];
  let n2;
  while ((n2 = walker2.nextNode())) textNodes2.push(n2);

  for (const tn of textNodes2) {
    let text = tn.textContent;
    let changed = false;

    for (const pair of dotPairs) {
      const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const brokenRe = new RegExp(escaped(pair.left) + '.' + escaped(pair.right), 'g');

      if (brokenRe.test(text) && !text.includes(pair.left + '·' + pair.right)) {
        text = text.replace(brokenRe, pair.left + '·' + pair.right);
        changed = true;
      }
    }

    if (changed) tn.textContent = text;
  }
}

/**
 * 별표(*, **, ***) 주석 들여쓰기 후처리
 * AI가 프롬프트를 따르지 않았을 때 강제 적용
 */
function fixStarIndent() {
  const container = elements.previewContent;
  if (!container) return;

  // 원문에서 별표 패턴과 개수 추출 (AI가 ★로 바꿔도 복원할 수 있도록)
  const srcHtml = state.originalSource?.html || state.sourceContent || elements.sourceEditor?.innerHTML || '';
  const srcTmp = document.createElement('div');
  srcTmp.innerHTML = srcHtml;
  const srcText = srcTmp.textContent || '';
  const srcStarLines = [];
  for (const line of srcText.split('\n')) {
    const m = line.trim().match(/^(\*{1,3})\s+(.{0,30})/);
    if (m) srcStarLines.push({ stars: m[1].length, snippet: m[2].trim().substring(0, 15) });
  }

  // 별표로 시작하는 요소 수집 (* 또는 ★)
  const starEls = [];
  container.querySelectorAll('p, li').forEach(el => {
    const text = el.textContent.trimStart();
    // * 패턴
    const mStar = text.match(/^(\*{1,3})\s/);
    if (mStar) {
      starEls.push({ el, stars: mStar[1].length, original: '*' });
      return;
    }
    // ★ 패턴 (AI가 *를 ★로 대체한 경우)
    const mBlack = text.match(/^(★{1,3})\s/);
    if (mBlack) {
      const snippet = text.replace(/^★{1,3}\s+/, '').substring(0, 15);
      const srcMatch = srcStarLines.find(s => snippet.startsWith(s.snippet.substring(0, 8)));
      const realStars = srcMatch ? srcMatch.stars : mBlack[1].length;
      starEls.push({ el, stars: realStars, original: '★', rawCount: mBlack[1].length });
      return;
    }
  });

  // ★ 원문 기반 강제 복원: AI가 *도 ★도 안 쓴 경우, 원문 snippet으로 찾아서 별표 삽입
  if (starEls.length === 0 && srcStarLines.length > 0) {
    container.querySelectorAll('p, li').forEach(el => {
      if (el.closest('table')) return;
      const text = el.textContent.trimStart();
      for (const src of srcStarLines) {
        if (src._matched) continue;
        if (text.substring(0, 20).includes(src.snippet.substring(0, 8))) {
          // 원문에서 이 줄은 별표로 시작했으나 AI가 별표를 제거함 → 복원
          const stars = '*'.repeat(src.stars);
          el.innerHTML = stars + ' ' + el.innerHTML;
          starEls.push({ el, stars: src.stars, original: 'restored' });
          src._matched = true;
          break;
        }
      }
    });
  }

  if (starEls.length === 0) return;

  // 별 수 분석: 모두 같은 수면 일반 리스트, 다르면 들여쓰기
  const starCounts = new Set(starEls.map(s => s.stars));
  const maxStars = Math.max(...starEls.map(s => s.stars));
  const isMixed = starCounts.size > 1;

  // 공통: ★→* 복원 + 임의 색상 span 제거 (AI가 ★에 color:red 등 추가하는 경우)
  starEls.forEach(({ el, original, stars }) => {
    if (original === '★') {
      // color span으로 감싼 ★ 패턴도 처리: <span style="color:...">★</span> → *
      el.innerHTML = el.innerHTML
        .replace(/<span[^>]*style="[^"]*color[^"]*"[^>]*>(★{1,3})/gi, '$1')
        .replace(/★{1,3}/, '*'.repeat(stars));
    }
    // 별표 줄 전체에서 AI가 추가한 color 인라인 스타일 제거
    el.querySelectorAll('[style*="color"]').forEach(span => {
      const style = span.getAttribute('style') || '';
      const cleaned = style.replace(/(?<![a-z-])color\s*:\s*[^;]+;?\s*/i, '').trim();
      if (!cleaned) {
        // style이 비면 span 풀기
        span.replaceWith(...span.childNodes);
      } else {
        span.setAttribute('style', cleaned);
      }
    });
  });

  if (!isMixed) {
    // === 동일 별 수 (* 단일 포함): <ul class="ulist star"> 리스트 ===
    // 연속된 별표 요소 → <ul class="ulist star">로 묶기
    let group = [];
    const groups = [];
    for (const item of starEls) {
      if (group.length === 0 || group[group.length - 1].el.parentNode === item.el.parentNode) {
        group.push(item);
      } else {
        groups.push(group);
        group = [item];
      }
    }
    if (group.length > 0) groups.push(group);

    groups.forEach(grp => {
      const ul = document.createElement('ul');
      ul.className = 'ulist star';
      grp[0].el.parentNode.insertBefore(ul, grp[0].el);
      grp.forEach(({ el }) => {
        const li = document.createElement('li');
        li.innerHTML = el.innerHTML;
        ul.appendChild(li);
        el.remove();
      });
    });
  } else {
    // === 혼합 별 수 (*, **, ***): star-list-indent 들여쓰기 ===
    starEls.forEach(({ el, stars }) => {
      if (el.classList.contains('star-list-indent')) return;

      const nbspCount = (maxStars - stars) * 2;
      const nbspStr = '&nbsp;'.repeat(nbspCount);

      el.innerHTML = el.innerHTML.replace(
        /^(\s|&nbsp;|\u00a0)*(\*{1,3})\s/,
        `${nbspStr}$2 `
      );

      el.classList.add('star-list-indent');
      el.style.paddingLeft = '1.6em';
      el.style.textIndent = '-1.6em';

      if (el.tagName === 'LI') {
        const p = document.createElement('p');
        p.className = el.className;
        p.setAttribute('style', el.getAttribute('style') || '');
        p.innerHTML = el.innerHTML;
        el.replaceWith(p);
      }
    });
  }
}

/**
 * 법률 조항(제N조) 평문 → ol/li 구조화 후처리
 * AI가 ol/li를 생성하지 않고 <p>로 출력한 법률 조항을 강제 변환
 */
/**
 * 법률 조항(제N조) 평문 → ol/li 구조화 후처리
 * 텍스트 기반: DOM 구조에 의존하지 않고, 섹션 내 전체 텍스트에서 번호 패턴을 추출하여 변환
 */
/**
 * 법률 조항(제N조) 후처리 — 텍스트 기반 접근
 * DOM 요소 스캔이 아닌, 섹션의 전체 텍스트를 줄 단위로 파싱하여 ol/li 구조 생성
 */
function fixLegalArticleStructure() {
  console.log('[fixLegalArticleStructure] 함수 호출됨');
  const container = elements.previewContent;
  if (!container) { console.log('[fixLegalArticleStructure] container 없음 → return'); return; }

  const fullText = container.textContent || '';
  if (!/제\d+조/.test(fullText)) { console.log('[fixLegalArticleStructure] "제N조" 없음 → return'); return; }

  const NUM_RE = /^(\d+(?:의\s?\d+)?)\.\s+(.*)/;
  const KO_RE = /^([가-힣])\.\s+(.*)/;

  // "제N조" 가 포함된 .sec_box 찾기
  const secBoxes = container.querySelectorAll('.sec_box');
  const targets = secBoxes.length > 0 ? Array.from(secBoxes) : [container];
  console.log('[fixLegalArticleStructure] sec_box 개수:', secBoxes.length, '/ 처리할 targets:', targets.length);

  for (const box of targets) {
    const boxText = box.textContent || '';
    if (!/제\d+조/.test(boxText)) { console.log('[fixLegalArticleStructure] box에 "제N조" 없음 → skip'); continue; }
    // 이미 legal-manual-num이 있으면 스킵
    if (box.querySelector('.legal-manual-num')) { console.log('[fixLegalArticleStructure] 이미 legal-manual-num 있음 → skip (★ 이게 원인일 가능성)'); continue; }

    // ★ 핵심: innerHTML → DOMParser → 텍스트 줄 단위 추출 (DOM 구조 무관)
    const tmp = document.createElement('div');
    tmp.innerHTML = box.innerHTML;
    // 테이블 콘텐츠 제거 (테이블 안 텍스트가 번호로 시작할 수 있음)
    tmp.querySelectorAll('table').forEach(t => t.remove());
    const rawText = tmp.innerText || tmp.textContent || '';
    const rawLines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 번호 항목 파싱
    const items = [];
    let current = null;
    let headerText = '';
    let foundFirst = false;

    for (const line of rawLines) {
      const numM = line.match(NUM_RE);
      const koM = line.match(KO_RE);

      if (numM) {
        foundFirst = true;
        if (current) items.push(current);
        current = { num: numM[1], text: numM[2], subItems: [] };
      } else if (koM && current) {
        current.subItems.push({ marker: koM[1], text: koM[2] });
      } else if (!foundFirst && /제\d+조/.test(line)) {
        headerText = line;
      } else if (current && line.length > 0) {
        // 이전 항목의 연속 텍스트
        if (current.subItems.length > 0) {
          const lastSub = current.subItems[current.subItems.length - 1];
          lastSub.text += ' ' + line;
        } else {
          current.text += ' ' + line;
        }
      }
    }
    if (current) items.push(current);

    // 최소 3개 번호 항목
    if (items.length < 3) continue;

    // ★ 원문 N의M 패턴으로 번호 강제 교정
    // AI가 "6의1."을 "7."로 바꿔도, 원문에 "6의1."이 있으면 복원
    const srcHtml = state.originalSource?.raw || state.sourceContent || elements.sourceEditor?.innerHTML || '';
    const normalize = s => (s || '').replace(/\s+/g, '').replace(/[.,()「」『』·•·]/g, '');

    if (srcHtml) {
      const srcTmp2 = document.createElement('div');
      srcTmp2.innerHTML = srcHtml;
      const srcPlain = (srcTmp2.innerText || srcTmp2.textContent || '').replace(/\s+/g, ' ');
      // N의M 다음에 텍스트 일부 (다른 N의M 또는 N. 가 나오기 전까지 50자)
      const subNumRe = /(\d+)의\s?(\d+)\.\s*([^\d]{1,50})/g;
      const srcSubNums = [];
      let sm;
      while ((sm = subNumRe.exec(srcPlain)) !== null) {
        srcSubNums.push({
          parent: parseInt(sm[1]),
          sub: parseInt(sm[2]),
          prefix: `${sm[1]}의${sm[2]}`,
          snippet: sm[3].trim(),
          snippetNorm: normalize(sm[3])
        });
      }

      console.log('[fixLegalArticleStructure] N의M 패턴 발견:', srcSubNums.length);
      srcSubNums.forEach(sn => console.log(`  원문 ${sn.prefix}: "${sn.snippet.substring(0, 40)}"`));
      console.log('[fixLegalArticleStructure] 변환된 항목 (총 ' + items.length + '개):');
      items.forEach((it, i) => console.log(`  [${i}] ${it.num}. "${it.text.substring(0, 40)}"`));

      if (srcSubNums.length > 0) {
        for (const sn of srcSubNums) {
          // 1차: 정규화된 텍스트 비교 (공백/구두점 제거 후 부분 일치)
          const snipNorm = sn.snippetNorm.substring(0, 10);
          let matchIdx = -1;
          if (snipNorm.length >= 4) {
            matchIdx = items.findIndex(it =>
              !(/^\d+의\s?\d+$/.test(it.num)) && normalize(it.text).includes(snipNorm)
            );
          }
          if (matchIdx >= 0) {
            console.log(`[fixLegalArticleStructure] snippet 매칭 성공: ${sn.prefix} → items[${matchIdx}] (${items[matchIdx].num}.)`);
            items[matchIdx].num = sn.prefix;
          } else {
            // 2차: 인덱스 폴백 (parent번 뒤 sub번째 위치)
            const parentIdx = items.findIndex(it => it.num === String(sn.parent));
            if (parentIdx >= 0) {
              const targetIdx = parentIdx + sn.sub;
              if (targetIdx < items.length && !(/^\d+의\s?\d+$/.test(items[targetIdx].num))) {
                console.log(`[fixLegalArticleStructure] 인덱스 폴백: ${sn.prefix} → items[${targetIdx}] (${items[targetIdx].num}.)`);
                items[targetIdx].num = sn.prefix;
              } else {
                console.log(`[fixLegalArticleStructure] 매칭 실패: ${sn.prefix} (snippet="${sn.snippet}")`);
              }
            } else {
              console.log(`[fixLegalArticleStructure] 매칭 실패 (parent ${sn.parent} 없음): ${sn.prefix}`);
            }
          }
        }
      }
    } else {
      console.log('[fixLegalArticleStructure] 원문 소스 없음');
    }

    // HTML 생성 (인라인 스타일 포함 — 다운로드 시 CSS 없어도 동작)
    let html = '';
    if (headerText) {
      html += `<p><strong>${headerText}</strong></p>\n`;
    }
    html += '<ol class="olist olnum legal-manual-num" style="padding-left: 15px;">\n';
    for (const item of items) {
      const isSubNum = /^\d+의\s?\d+$/.test(item.num);
      const numVal = parseInt(item.num) || 0;
      let liClass = 'has-marker';
      let liStyle;
      if (isSubNum) {
        liClass += ' legal-sub-item';
        liStyle = 'style="padding-left: 2.5em; text-indent: -2.5em;"';
      } else if (numVal >= 10) {
        liClass += ' legal-2d';
        liStyle = 'style="padding-left: 1.5em; text-indent: -1.5em;"';
      } else {
        liClass += ' legal-1d';
        liStyle = 'style="padding-left: 1.2em; text-indent: -1.2em;"';
      }
      html += `  <li class="${liClass}" ${liStyle}>${item.num}. ${item.text}`;
      if (item.subItems.length > 0) {
        html += '\n    <ol class="olist kolist" style="margin-left: 2.5em;">\n';
        for (const sub of item.subItems) {
          html += `      <li class="has-marker" style="padding-left: 0; text-indent: 0;">${sub.marker}. ${sub.text}</li>\n`;
        }
        html += '    </ol>\n  ';
      }
      html += '</li>\n';
    }
    html += '</ol>';

    // 기존 콘텐츠 교체: 테이블은 보존하고 나머지 콘텐츠를 교체
    // 테이블을 임시 저장
    const tables = Array.from(box.querySelectorAll(':scope > .table_x, :scope > table, :scope > div > .table_x, :scope > div > table'));
    const savedTables = tables.map(t => ({ el: t, parent: t.parentNode, next: t.nextSibling }));

    // 비테이블 콘텐츠 전부 제거
    const children = Array.from(box.childNodes);
    children.forEach(child => {
      if (child.nodeType === 1 && (child.classList?.contains('table_x') || child.tagName === 'TABLE')) return;
      if (child.nodeType === 1 && child.querySelector?.('.table_x, table')) return;
      child.remove();
    });

    // 새 HTML 삽입 (테이블 앞에)
    const firstTable = box.querySelector('.table_x, table');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    while (wrapper.firstChild) {
      if (firstTable) {
        box.insertBefore(wrapper.firstChild, firstTable);
      } else {
        box.appendChild(wrapper.firstChild);
      }
    }

    break; // 하나의 법률 조항만 처리
  }
}

/**
 * AI가 임의로 추가한 색상 제거
 * 원문에 없는 color 인라인 스타일을 strip
 */
/**
 * 원문에 있는 제목/소제목이 변환 결과에서 누락된 경우 복원
 * 원문 텍스트에서 제목 후보를 추출하고, 변환 결과의 h2/h3와 비교하여 누락분 삽입
 */
function fixArbitraryColors() {
  const container = elements.previewContent;
  if (!container) return;

  // 원문 HTML에서 사용된 색상 추출 (color와 background-color 모두)
  const originalColors = new Set();
  const srcHtml = state.originalSource?.html || state.sourceContent || elements.sourceEditor?.innerHTML || '';
  if (srcHtml) {
    // 색상 값 정규화 함수
    const normalizeColor = (val) => {
      val = val.trim().toLowerCase();
      // 기본 색상명 → hex 매핑
      const map = { red: '#ff0000', blue: '#0000ff', green: '#008000', black: '#000000', white: '#ffffff' };
      return map[val] || val;
    };

    const colorMatches = srcHtml.match(/(?<![a-z-])color\s*:\s*([^;"'\s}]+)/gi) || [];
    colorMatches.forEach(m => {
      const val = m.replace(/(?<![a-z-])color\s*:\s*/i, '').trim();
      originalColors.add(normalizeColor(val));
    });
  }

  // 흑백(#000, #000000, black)은 항상 허용 (기본 텍스트 색상)
  originalColors.add('#000000');
  originalColors.add('#000');
  originalColors.add('black');
  originalColors.add('rgb(0, 0, 0)');

  // 미리보기에서 인라인 color 스타일이 있는 요소 검사
  container.querySelectorAll('[style]').forEach(el => {
    const style = el.getAttribute('style') || '';
    // color 값 추출 (background-color는 제외)
    const colorMatch = style.match(/(?<![a-z-])color\s*:\s*([^;]+)/i);
    if (!colorMatch) return;

    const rawVal = colorMatch[1].trim().toLowerCase();
    if (rawVal === 'inherit' || rawVal === 'initial' || rawVal === 'unset') return;

    // 색상명→hex 정규화 후 비교
    const map = { red: '#ff0000', blue: '#0000ff', green: '#008000', black: '#000000', white: '#ffffff' };
    const normalized = map[rawVal] || rawVal;

    // 원문에 이 색상이 없으면 제거
    if (!originalColors.has(normalized) && !originalColors.has(rawVal)) {
      const cleaned = style.replace(/(?<![a-z-])color\s*:\s*[^;]+;?\s*/i, '').trim();
      if (cleaned) {
        el.setAttribute('style', cleaned);
      } else {
        el.removeAttribute('style');
      }
    }
  });
}

function updatePreview() {
  if (!state.convertedHtml) {
    elements.previewContent.innerHTML = `
      <div class="empty-state">
        <p>원문을 첨부하면 자동으로 변환되어 여기에 표시됩니다</p>
      </div>
    `;
    return;
  }

  const template = templates[state.template];

  // templwrap_v3 래퍼가 포함된 경우 내부 콘텐츠만 추출 (이중 중첩 방지)
  let renderContent = state.convertedHtml;
  if (/id=["']?templwrap_v3/i.test(renderContent)) {
    const tmp = document.createElement('div');
    tmp.innerHTML = renderContent;
    const tc = tmp.querySelector('#templwrap_v3 .templ_content');
    if (tc) renderContent = tc.innerHTML;
  }

  const rendered = template.render({
    keyVisual: state.keyVisualUrl,
    content: renderContent,
    jobNumber: state.jobNumber
  });

  elements.previewContent.innerHTML = rendered;

  // v3 템플릿: <h2> 헤딩 → .sec_wrap 섹션 구조 변환 + 선행 번호 제거
  wrapInV3Sections();

  // 테이블에 인크루트 표준 클래스 적용 (다운로드와 동일하게)
  applyIncruitTableClassesToDom(elements.previewContent);

  // 이중 마커 제거 (CSS ::before + 텍스트 마커 중복 방지)
  fixDoubleMarkers();

  // v2 파이프라인은 자체 구조화를 사용 — v1 후처리 건너뜀
  if (localStorage.getItem('pipeline_version') !== 'v2') {
    // AI가 번호 리스트를 <p> 평문으로 출력한 경우 → <ol>/<li>로 구조화
    fixPlainTextNumberedList();

    // 법률 조항(제N조) 평문 → ol/li 구조화 (AI가 ol/li 미생성 시 강제 변환)
    fixLegalArticleStructure();

    // 한국 법률 "N의M" 번호 후처리 (들여쓰기 + 자동번호 제거 + 후속 번호 리셋)
    fixLegalSubNumbering();
  }

  // 별표(*, **, ***) 주석 들여쓰기 (AI 미적용 시 강제)
  fixStarIndent();

  // 가운뎃점(·) 복원: 원문에 있는 "X·Y" 패턴이 변환에서 깨진 경우 복원
  fixMiddleDots();

  // AI가 임의 추가한 색상 제거 (원문에 없는 color 스타일 strip)
  fixArbitraryColors();

  // KV 섹션 표시 상태 동기화
  syncKvVisibility();
  syncNonKvFieldsVisibility();

  // 채용공고 번호 미리보기 반영
  refreshJobNumberInPreview();

  // 하단 버튼 반영
  refreshBottomButtonsInPreview();

  // 이미지맵+인트로 링크 오버레이 (미리보기: opacity 0.3)
  renderIntroLinkOverlay();

  // 편집 모드가 켜져 있으면 다시 적용
  if (state.editMode) {
    setupInlineEditors();
  }

  // 세션 저장 (변환 결과 유지)
  saveSession();
}

/** 채용공고 번호를 미리보기 kv-header-area에 반영 */
function refreshJobNumberInPreview() {
  const kvHeader = document.getElementById('kv-header-area');
  if (!kvHeader) return;

  // 기존 헤더 텍스트 요소 전부 제거
  kvHeader.querySelectorAll('.templ_num, .templ_company, .templ_date').forEach(el => el.remove());

  // KV 모드 ON일 때는 비KV 입력값 렌더링 안 함 (KV 패널 내용으로 대체)
  if (state.kvEnabled) return;

  kvHeader.style.position = 'relative';

  // 헤더 텍스트 요소 생성 헬퍼
  function appendHeaderText(text, style, align, className) {
    if (!text) return;
    const p = document.createElement('p');
    p.className = className;
    p.style.position = 'absolute';
    p.style.top      = (style.top ?? 10) + '%';
    p.style.left       = '0';
    p.style.right      = '0';
    p.style.padding    = '0 4.444%';
    p.style.lineHeight = '1.5';
    p.style.margin     = '0';
    p.style.textAlign  = align || 'left';
    p.style.fontSize   = (style.fontSize || 14) + 'px';
    p.style.color      = style.color || '#333333';
    p.style.fontWeight = style.bold ? '700' : '400';
    p.textContent = text;
    kvHeader.appendChild(p);
  }

  appendHeaderText(state.jobNumber,         state.jobNumberStyle,   state.jobNumberAlign,   'templ_num');
  appendHeaderText(state.headerCompanyName, state.companyNameStyle, state.companyNameAlign, 'templ_company');
  appendHeaderText(state.headerDate,        state.headerDateStyle,  state.headerDateAlign,  'templ_date');

  // 편집 모드에서 새로 생성된 헤더 텍스트에 인라인 편집 재부착
  if (state.editMode) setupSpecialInlineEditors();
}

/** 인트로 링크 오버레이 HTML 문자열 생성 (다운로드/복사용) */
function buildIntroLinkHtml(opacity = '0') {
  const areas = state.kv.imageMapAreas;
  if (!areas || areas.length === 0) return '';
  let html = '';
  areas.forEach((area, idx) => {
    const href = area.url || '#';
    const alt = area.label || `영역 ${idx + 1}`;
    html += `    <a href="${escapeHtml(href)}" target="_blank" class="noko intro-link-overlay" alt="${escapeHtml(alt)}" style="position:absolute; left:${area.left.toFixed(2)}%; top:${area.top.toFixed(2)}%; width:${area.width.toFixed(2)}%; height:${area.height.toFixed(2)}%; opacity:${opacity}; display:block;"></a>\n`;
  });
  return html;
}

/** 이미지맵+인트로: templ_header 안에 투명 링크 오버레이 삽입 */
function renderIntroLinkOverlay() {
  const container = elements.previewContent;
  if (!container) return;
  const areas = state.kv.imageMapAreas;

  // 기존 오버레이 제거
  container.querySelectorAll('.intro-link-overlay').forEach(el => el.remove());

  if (!areas || areas.length === 0) return;

  // templ_header 찾기 (KV 이미지가 있는 곳)
  const header = container.querySelector('.templ_header:not(.none)');
  if (!header) return;

  // position: relative 보장
  if (!header.style.position || header.style.position === 'static') {
    header.style.position = 'relative';
  }

  // <a> 오버레이 삽입 (미리보기: opacity 0.3)
  areas.forEach((area, idx) => {
    const a = document.createElement('a');
    a.href = area.url || '#';
    a.target = '_blank';
    a.className = 'noko intro-link-overlay';
    a.setAttribute('alt', area.label || `영역 ${idx + 1}`);
    a.style.cssText = `position:absolute; left:${area.left.toFixed(2)}%; top:${area.top.toFixed(2)}%; width:${area.width.toFixed(2)}%; height:${area.height.toFixed(2)}%; opacity:0.3; display:block; background:rgba(0,102,204,0.15); z-index:5;`;
    header.appendChild(a);
  });
}

/** 하단 버튼을 templ_content 끝에 반영 */
function refreshBottomButtonsInPreview() {
  const content = document.querySelector('#preview-content .templ_content');
  if (!content) return;

  // 기존 래퍼 제거
  content.querySelectorAll('.templ-bottom-btn-wrap').forEach(el => el.remove());

  if (!state.bottomButtons || state.bottomButtons.length === 0) return;

  const wrap = document.createElement('div');
  wrap.className = 'templ-bottom-btn-wrap';

  const h40top = document.createElement('div');
  h40top.className = 'h40';

  const btnContainer = document.createElement('div');
  btnContainer.className = 'templ-bottom-btn';

  state.bottomButtons.forEach((btn, idx) => {
    const a = document.createElement('a');
    a.href = btn.href || '#';
    a.target = '_blank';
    const span = document.createElement('span');
    span.className = btn.styleClass || 'temp_btn btn';
    span.dataset.btnIdx = idx;
    if ((btn.styleClass || '').includes('icon_carrow')) {
      const inner = document.createElement('span');
      inner.textContent = btn.text || '버튼';
      span.appendChild(inner);
    } else {
      span.textContent = btn.text || '버튼';
    }
    a.appendChild(span);
    btnContainer.appendChild(a);
  });

  const h40bot = document.createElement('div');
  h40bot.className = 'h40';

  wrap.appendChild(h40top);
  wrap.appendChild(btnContainer);
  wrap.appendChild(h40bot);
  content.appendChild(wrap);

  // 버튼 색상 CSS 갱신
  updateCssVariables();

  // 편집 모드에서 새로 생성된 버튼 텍스트에 인라인 편집 재부착
  if (state.editMode) setupSpecialInlineEditors();
}

const BOTTOM_BTN_STYLES = [
  ['temp_btn btn',              '기본 1'],
  ['temp_btn btn2 radius10',   '기본 2'],
  ['temp_btn btn3',             '기본 3'],
  ['temp_btn btn4',             '기본 4'],
  ['temp_btn btn5',             '기본 5'],
  ['temp_btn btn6 radius10',   '기본 6'],
  ['temp_btn btn7',             '기본 7'],
  ['temp_btn btn_a1',           'hover 10'],
  ['temp_btn btn_a2',           'hover 11'],
  ['temp_btn btn_a3 radius10', 'hover 12'],
  ['temp_btn btn_a5 icon_carrow','hover 14'],
];

/**
 * 스타일별 색상 피커 구성 반환
 * normal: 기본 상태 피커 배열 [[key, label], ...]
 * hover:  hover 상태 피커 배열 (없으면 [])
 */
function getPickerConfig(sc) {
  const normal = [], hover = [];
  if (sc.includes('btn7')) {
    normal.push(['bgColor', '배경색'], ['gradColor1', '그라디언트 1색'], ['gradColor2', '그라디언트 2색'], ['textColor', '글자색']);
  } else if (sc.includes('btn6')) {
    normal.push(['bgColor', '배경색'], ['shadowColor', '그림자색'], ['textColor', '글자색']);
  } else if (sc.includes('btn4')) {
    normal.push(['bgColor', '배경색'], ['borderColor', '선색'], ['shadowColor', '그림자색'], ['textColor', '글자색']);
  } else if (sc.includes('btn5') || sc.includes('btn2')) {
    normal.push(['bgColor', '배경색'], ['borderColor', '선색'], ['textColor', '글자색']);
  } else if (sc.includes('btn_a3')) {
    normal.push(['bgColor', '배경색'], ['shadowColor', '그림자색'], ['textColor', '글자색']);
    hover.push(['hoverShadowColor', 'hover그림자'], ['hoverTextColor', 'hover글자색']);
  } else if (sc.includes('btn_a1')) {
    normal.push(['bgColor', '배경색'], ['textColor', '글자색']);
    hover.push(['hoverBgColor', 'hover배경색'], ['hoverTextColor', 'hover글자색']);
  } else if (sc.includes('icon_carrow')) {
    normal.push(['bgColor', '배경색'], ['borderColor', '선색'], ['textColor', '글자색']);
    hover.push(['hoverBgColor', 'hover배경색'], ['hoverTextColor', 'hover글자색']);
  } else {
    // btn, btn3, btn_a2, btn_a4, btn_a5, btn_a6 등
    normal.push(['bgColor', '배경색'], ['textColor', '글자색']);
  }
  return { normal, hover };
}

/** 하단 버튼 목록 UI 갱신 (인라인 실시간 편집) */
function renderBottomBtnList() {
  const list = document.getElementById('bottom-btn-list');
  if (!list) return;
  list.innerHTML = '';

  (state.bottomButtons || []).forEach((btn, idx) => {
    const item = document.createElement('div');
    item.className = 'p-2 rounded bg-gray-800 space-y-1 text-xs';

    // 1행: 버튼명 + 삭제
    const row1 = document.createElement('div');
    row1.className = 'flex gap-1 items-center';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.value = btn.text || '';
    textInput.placeholder = '버튼명';
    textInput.className = 'setting-input text-xs flex-1';
    textInput.addEventListener('input', () => {
      state.bottomButtons[idx].text = textInput.value;
      refreshBottomButtonsInPreview();
      saveSession();
    });
    const delBtn = document.createElement('button');
    delBtn.className = 'text-red-400 hover:text-red-300 px-1 flex-shrink-0';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      state.bottomButtons.splice(idx, 1);
      renderBottomBtnList();
      refreshBottomButtonsInPreview();
      updateHtmlCode();
      saveSession();
    });
    row1.append(textInput, delBtn);

    // 2행: URL
    const hrefInput = document.createElement('input');
    hrefInput.type = 'text';
    hrefInput.value = btn.href || '';
    hrefInput.placeholder = 'URL (https://...)';
    hrefInput.className = 'setting-input text-xs w-full';
    hrefInput.addEventListener('input', () => {
      state.bottomButtons[idx].href = hrefInput.value;
      refreshBottomButtonsInPreview();
      saveSession();
    });

    // 3행: 스타일 선택
    const row3 = document.createElement('div');
    row3.className = 'flex gap-1 items-center';
    const styleSelect = document.createElement('select');
    styleSelect.className = 'setting-input text-xs flex-1';
    styleSelect.style.cssText = 'padding:2px 4px;';
    BOTTOM_BTN_STYLES.forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if (val === (btn.styleClass || 'temp_btn btn')) opt.selected = true;
      styleSelect.appendChild(opt);
    });
    row3.append(styleSelect);

    // 색상 피커 컨테이너 (스타일 변경 시 재렌더)
    const pickerWrap = document.createElement('div');
    const pickerInputStyle = 'width:26px;height:26px;padding:1px;border-radius:4px;cursor:pointer;flex-shrink:0;';

    // key에 대한 기본값 반환
    function colorDefault(key) {
      const bg = btn.bgColor || '#FF460A';
      const tc = btn.textColor || '#FFFFFF';
      switch (key) {
        case 'bgColor':          return btn.bgColor           || '#FF460A';
        case 'textColor':        return btn.textColor         || '#FFFFFF';
        case 'borderColor':      return btn.borderColor       || bg;
        case 'shadowColor':      return btn.shadowColor       || bg;
        case 'gradColor1':       return btn.gradColor1        || '#FFB40A';
        case 'gradColor2':       return btn.gradColor2        || bg;
        case 'hoverBgColor':     return btn.hoverBgColor      || darkenHex(bg);
        case 'hoverTextColor':   return btn.hoverTextColor    || tc;
        case 'hoverShadowColor': return btn.hoverShadowColor  || darkenHex(btn.shadowColor || bg);
        default:                 return '#FF460A';
      }
    }

    // 피커 1개 생성: [input.color] [label]
    function makePicker(key, label) {
      const wrap = document.createElement('div');
      wrap.className = 'flex items-center gap-1';
      const p = document.createElement('input');
      p.type = 'color';
      p.value = colorDefault(key);
      p.style.cssText = pickerInputStyle;
      p.addEventListener('input', () => {
        state.bottomButtons[idx][key] = p.value;
        refreshBottomButtonsInPreview();
        saveSession();
      });
      const lbl = document.createElement('span');
      lbl.className = 'text-gray-400';
      lbl.textContent = label;
      wrap.append(p, lbl);
      return wrap;
    }

    // 스타일에 맞게 피커 다시 그리기
    function renderPickers(sc) {
      pickerWrap.innerHTML = '';
      const { normal, hover } = getPickerConfig(sc);
      const normalRow = document.createElement('div');
      normalRow.className = 'flex flex-wrap gap-x-3 gap-y-1';
      normal.forEach(([key, lbl]) => normalRow.appendChild(makePicker(key, lbl)));
      pickerWrap.appendChild(normalRow);
      if (hover.length > 0) {
        const sep = document.createElement('div');
        sep.className = 'text-gray-600 text-xs';
        sep.textContent = '— hover —';
        const hoverRow = document.createElement('div');
        hoverRow.className = 'flex flex-wrap gap-x-3 gap-y-1';
        hover.forEach(([key, lbl]) => hoverRow.appendChild(makePicker(key, lbl)));
        pickerWrap.append(sep, hoverRow);
      }
    }

    renderPickers(btn.styleClass || 'temp_btn btn');

    styleSelect.addEventListener('change', () => {
      state.bottomButtons[idx].styleClass = styleSelect.value;
      renderPickers(styleSelect.value);
      refreshBottomButtonsInPreview();
      saveSession();
    });

    item.append(row1, hrefInput, row3, pickerWrap);
    list.appendChild(item);
  });
}

// ============================================
// 인라인 편집 기능
// ============================================

/**
 * 다중 요소 드래그 선택 상태 관리
 */
const _multiLineSelect = {
  isDragging: false,
  dragStartElement: null,
  dragStartX: 0,
  dragStartY: 0,
  dragThresholdMet: false,
  // 원본 클릭 지점의 caret (cross-element 드래그 시 선택 시작 위치 유지용)
  dragStartCaretNode: null,
  dragStartCaretOffset: 0
};

/** 주어진 클라이언트 좌표에서 caret(텍스트 위치) 추출 — 브라우저별 API 대응 */
function _getCaretAtPoint(x, y) {
  if (document.caretPositionFromPoint) {
    const cp = document.caretPositionFromPoint(x, y);
    return cp ? { node: cp.offsetNode, offset: cp.offset } : null;
  }
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

/**
 * startElement부터 endElement까지 모든 editable 요소의 텍스트를 선택
 */
function selectElementRange(startElement, endElement, endX, endY) {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;

  // 편집 가능 요소들 (DOM 순서대로)
  const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, li, td, th';
  const allEditableElements = Array.from(previewContent.querySelectorAll(editableSelectors));

  // startElement와 endElement의 인덱스 찾기
  const startIdx = allEditableElements.indexOf(startElement);
  const endIdx = allEditableElements.indexOf(endElement);

  if (startIdx === -1 || endIdx === -1) return;

  const isForward = startIdx <= endIdx;  // 정방향(위→아래) or 역방향(아래→위)

  const range = document.createRange();
  const sel = window.getSelection();

  // 시작 위치: 원본 클릭 지점의 caret 사용 (없으면 첫 텍스트 노드 폴백)
  const startCaretNode = _multiLineSelect.dragStartCaretNode;
  const startCaretOffset = _multiLineSelect.dragStartCaretOffset;
  const hasStartCaret = startCaretNode && startElement.contains(startCaretNode);

  // 종료 위치: 현재 마우스 위치의 caret (cross-element 드래그 종료점)
  const endCaret = (endX != null && endY != null) ? _getCaretAtPoint(endX, endY) : null;
  const hasEndCaret = endCaret && endElement.contains(endCaret.node);

  if (isForward) {
    // 정방향 드래그: start = 원본 클릭 지점, end = 현재 마우스 위치
    if (hasStartCaret) {
      range.setStart(startCaretNode, startCaretOffset);
    } else {
      const firstTextNode = getFirstTextNode(startElement);
      if (!firstTextNode) return;
      range.setStart(firstTextNode, 0);
    }
    if (hasEndCaret) {
      range.setEnd(endCaret.node, endCaret.offset);
    } else {
      const lastTextNode = getLastTextNode(endElement);
      if (!lastTextNode) return;
      range.setEnd(lastTextNode, lastTextNode.length);
    }
  } else {
    // 역방향 드래그 (아래→위): start = 현재 마우스 위치, end = 원본 클릭 지점
    if (hasEndCaret) {
      range.setStart(endCaret.node, endCaret.offset);
    } else {
      const firstTextNode = getFirstTextNode(endElement);
      if (!firstTextNode) return;
      range.setStart(firstTextNode, 0);
    }
    if (hasStartCaret) {
      range.setEnd(startCaretNode, startCaretOffset);
    } else {
      const lastTextNode = getLastTextNode(startElement);
      if (!lastTextNode) return;
      range.setEnd(lastTextNode, lastTextNode.length);
    }
  }

  // 선택 적용
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * 요소 내 첫 번째 TEXT_NODE 반환
 */
function getFirstTextNode(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  return walker.nextNode();
}

/**
 * 요소 내 마지막 TEXT_NODE 반환
 */
function getLastTextNode(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  let last = null;
  let node;
  while ((node = walker.nextNode())) {
    last = node;
  }
  return last;
}

function toggleEditMode(enabled) {
  const templatePreview = document.getElementById('template-preview');
  const previewContent = document.getElementById('preview-content');

  if (!templatePreview || !previewContent) return;

  if (enabled) {
    templatePreview.classList.add('edit-mode-active');
    // 편집 모드 진입 시 히스토리 초기화 + 초기 스냅샷 저장
    editHistory.past = [];
    editHistory.future = [];
    setupInlineEditors();
    editHistory.push();
    showEditModeBanner();
    floatingToolbar.show();
  } else {
    templatePreview.classList.remove('edit-mode-active');
    removeInlineEditors();
    hideEditModeBanner();
    tableToolbar.hide();
    floatingToolbar.hide();
  }
}

function setupInlineEditors() {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;

  // 편집 가능한 요소들 선택
  const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, li, td, th';
  const editableElements = previewContent.querySelectorAll(editableSelectors);

  editableElements.forEach(el => {
    // 이미 설정된 요소는 건너뜀
    if (el.dataset.editableSetup) return;

    // 빈 요소나 bullet-icon만 있는 요소는 제외
    const textContent = el.textContent.trim();
    if (!textContent) return;

    el.dataset.editableSetup = 'true';

    // 즉시 contenteditable 활성화 — 클릭 전부터 드래그 선택 가능
    el.setAttribute('contenteditable', 'true');
    el.dataset.originalContent = el.innerHTML;

    // mousedown: undo 스냅샷 저장
    el.addEventListener('mousedown', handleEditableClick);

    // blur 이벤트 - 편집 내용 저장
    el.addEventListener('blur', handleEditableBlur);

    // 키보드 이벤트 - Enter로 저장, Escape로 취소
    el.addEventListener('keydown', handleEditableKeydown);
  });

  // 편집 중 붙여넣기: 인라인 스타일 제거 후 순수 텍스트/구조만 삽입
  if (!previewContent._inlinePasteHandler) {
    previewContent._inlinePasteHandler = (e) => {
      const active = document.activeElement;
      if (!active || active.getAttribute('contenteditable') !== 'true') return;
      if (!previewContent.contains(active)) return;
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      const text = e.clipboardData.getData('text/plain');
      let insert;
      if (html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        // <!--StartFragment--> / <!--EndFragment--> 클립보드 마커 주석 제거
        const commentWalker = document.createTreeWalker(tmp, NodeFilter.SHOW_COMMENT);
        const commentNodes = [];
        let cNode;
        while ((cNode = commentWalker.nextNode())) commentNodes.push(cNode);
        commentNodes.forEach(n => n.remove());
        // 인라인 스타일·클래스 전부 제거, 구조 태그만 유지
        tmp.querySelectorAll('*').forEach(el => {
          el.removeAttribute('style');
          el.removeAttribute('class');
          el.removeAttribute('id');
        });
        // 불필요한 span/div를 평탄화 (텍스트만 있는 경우)
        tmp.querySelectorAll('span, div').forEach(el => {
          const allowed = ['b','strong','em','i','u','br'];
          if (!allowed.includes(el.tagName.toLowerCase()) &&
              !el.querySelector('p,ul,ol,li,table,tr,td,th,h1,h2,h3,h4,h5,h6')) {
            el.replaceWith(...el.childNodes);
          }
        });
        insert = tmp.innerHTML;
      } else {
        insert = text.replace(/\n/g, '<br>');
      }
      document.execCommand('insertHTML', false, insert);
    };
    previewContent.addEventListener('paste', previewContent._inlinePasteHandler);
  }

  // spacer label 초기화 (click은 이벤트 위임으로 처리)
  previewContent.querySelectorAll('div.h10, div.h20, div.h30, div.h40').forEach(el => {
    const cls = [...el.classList].find(c => /^h[1-4]0$/.test(c)) || 'h20';
    el.dataset.spacerLabel = cls;
  });

  // 블록 요소 hover → spacer 삽입 "+" 버튼 표시
  setupSpacerInsertHover(previewContent);

  // ---- 다중 요소 드래그 선택 ----
  if (!previewContent._multiSelectHandler) {
    previewContent._multiSelectHandler = (e) => {
      if (!_multiLineSelect.isDragging || !_multiLineSelect.dragStartElement) return;

      // 드래그 임계값 (6px) — 미달 시 단순 클릭으로 간주
      if (!_multiLineSelect.dragThresholdMet) {
        const dx = e.clientX - _multiLineSelect.dragStartX;
        const dy = e.clientY - _multiLineSelect.dragStartY;
        if (dx * dx + dy * dy < 36) return;
        _multiLineSelect.dragThresholdMet = true;
      }

      // 마우스 위치의 정확한 요소 찾기 (elementFromPoint 사용)
      const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, li, td, th';
      let currentElement = null;

      // 1. 마우스 위치의 최상단 요소 찾기
      const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      if (elementAtPoint) {
        currentElement = elementAtPoint.closest(editableSelectors);
      }

      // 2. elementFromPoint로 찾지 못한 경우, Y 좌표 기준 가장 가까운 요소 찾기
      if (!currentElement) {
        const allEditableElements = Array.from(previewContent.querySelectorAll(editableSelectors));
        let closest = null;
        let minDist = Infinity;

        allEditableElements.forEach(el => {
          const rect = el.getBoundingClientRect();
          // Y 좌표 기준 거리 계산
          let dist;
          if (e.clientY < rect.top) {
            dist = rect.top - e.clientY;
          } else if (e.clientY > rect.bottom) {
            dist = e.clientY - rect.bottom;
          } else {
            dist = 0; // Y 범위 내
          }

          if (dist < minDist) {
            minDist = dist;
            closest = el;
          }
        });

        currentElement = closest;
      }

      // 3. 선택 범위 업데이트
      // ★ 다른 요소로 이동했을 때만 크로스 엘리먼트 선택 활성화
      if (currentElement && previewContent.contains(currentElement)) {
        if (currentElement !== _multiLineSelect.dragStartElement) {
          // 다른 요소로 드래그 → 원본 클릭 지점 + 현재 마우스 지점 기준 선택
          selectElementRange(_multiLineSelect.dragStartElement, currentElement, e.clientX, e.clientY);
        }
        // 같은 요소 내 → 브라우저 기본 선택 허용 (selectElementRange 미호출)
      }
    };

    previewContent._multiSelectEndHandler = (e) => {
      if (_multiLineSelect.isDragging) {
        const previewContent = document.getElementById('preview-content');
        const sel = window.getSelection();

        if (_multiLineSelect.dragThresholdMet && sel && !sel.isCollapsed) {
          // 다중 선택 완료 — 선택된 텍스트 유지
          // originalContent는 blur 이벤트에서 갱신됨
        } else if (!_multiLineSelect.dragThresholdMet) {
          // 단순 클릭 (6px 미만 드래그)
          // selection 유지 (contenteditable 자동 처리)
        }
      }

      // 상태 정리
      _multiLineSelect.isDragging = false;
      _multiLineSelect.dragStartElement = null;
      _multiLineSelect.dragThresholdMet = false;
    };

    previewContent.addEventListener('mousemove', previewContent._multiSelectHandler);
    document.addEventListener('mouseup', previewContent._multiSelectEndHandler);
  }

  // 특수 필드 (헤더 / KV 카드 / 하단 버튼) 인라인 편집 설정
  setupSpecialInlineEditors();
}

// ─── 특수 필드 인라인 편집 (헤더 텍스트 / KV 카드 / 하단 버튼) ───
// 본문 텍스트는 #preview-content .templ_content 안에 있어서 saveInlineEdits 로 state.convertedHtml 에
// 바로 덮이지만, 헤더/KV/버튼은 state.jobNumber·state.kv·state.bottomButtons 에 별도 저장되어
// 다운로드 시 state 기반으로 재생성됨. 따라서 인라인 편집 결과를 blur 시점에 state로 역동기화해야 함.

function setupSpecialInlineEditors() {
  if (!state.editMode) return;
  const headerArea = document.getElementById('kv-header-area');
  const previewContent = document.getElementById('preview-content');

  const targets = [];
  if (headerArea) {
    headerArea.querySelectorAll('.templ_num')    .forEach(el => targets.push({ el, kind: 'headerJobNumber'    }));
    headerArea.querySelectorAll('.templ_company').forEach(el => targets.push({ el, kind: 'headerCompanyName' }));
    headerArea.querySelectorAll('.templ_date')   .forEach(el => targets.push({ el, kind: 'headerDate'        }));

    const card = document.getElementById('kv-preview-card');
    if (card) {
      card.querySelectorAll('.kv-job-code')     .forEach(el => targets.push({ el, kind: 'kvJobCode'      }));
      card.querySelectorAll('.kv-org-name-text').forEach(el => targets.push({ el, kind: 'kvOrgName'      }));
      card.querySelectorAll('.kv-title-text')   .forEach(el => targets.push({ el, kind: 'kvTitle'        }));
      card.querySelectorAll('.kv-desc-text')    .forEach(el => targets.push({ el, kind: 'kvDescription'  }));
      card.querySelectorAll('.kv-desc-text-2')  .forEach(el => targets.push({ el, kind: 'kvDescription2' }));
      card.querySelectorAll('.kv-footer-text')  .forEach(el => targets.push({ el, kind: 'kvDateCompany'  }));
    }
  }

  if (previewContent) {
    previewContent.querySelectorAll('.templ-bottom-btn span.temp_btn[data-btn-idx]').forEach(span => {
      // icon_carrow 스타일은 내부 span에 텍스트가 들어감
      const textEl = (span.classList.contains('icon_carrow') && span.firstElementChild)
        ? span.firstElementChild
        : span;
      const idx = Number(span.dataset.btnIdx);
      if (!Number.isFinite(idx)) return;
      targets.push({ el: textEl, kind: 'bottomButton', idx });
      // 편집 모드에서 <a> 클릭 시 실제 navigate 방지
      const anchor = span.closest('a');
      if (anchor && !anchor.dataset.editNavBlock) {
        anchor.dataset.editNavBlock = 'true';
        anchor.addEventListener('click', _blockAnchorInEditMode);
      }
    });
  }

  targets.forEach(({ el, kind, idx }) => {
    if (el.dataset.specialEditableSetup) return;
    el.dataset.specialEditableSetup = 'true';
    el.dataset.specialEditKind = kind;
    if (idx !== undefined) el.dataset.specialEditIdx = String(idx);
    el.setAttribute('contenteditable', 'true');
    el.dataset.originalContent = el.innerHTML;

    el.addEventListener('mousedown', handleSpecialEditMousedown);
    el.addEventListener('blur',      handleSpecialEditBlur);
    el.addEventListener('keydown',   handleSpecialEditKeydown);
  });
}

function _blockAnchorInEditMode(e) {
  if (state.editMode) { e.preventDefault(); e.stopPropagation(); }
}

function handleSpecialEditMousedown(e) {
  const el = e.currentTarget;
  editHistory.push();
  if (!el.dataset.originalContent) el.dataset.originalContent = el.innerHTML;
  el.focus();
}

function handleSpecialEditKeydown(e) {
  const el = e.currentTarget;
  const kind = el.dataset.specialEditKind;
  const multilineKinds = new Set([
    'kvTitle', 'kvOrgName', 'kvDescription', 'kvDescription2', 'kvDateCompany'
  ]);

  if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    document.execCommand('insertLineBreak');
  } else if (e.key === 'Enter' && !e.shiftKey) {
    if (multilineKinds.has(kind)) {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    } else {
      e.preventDefault();
      el.blur();
    }
  } else if (e.key === 'Escape') {
    if (el.dataset.originalContent != null) el.innerHTML = el.dataset.originalContent;
    el.blur();
  }
}

// innerHTML → plain text (with \n), <br> / block 경계를 개행으로 치환
function _specialEditPlainText(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  return clone.textContent.replace(/\u00a0/g, ' ');
}

function _syncInputValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if ('value' in el && el.value !== value) el.value = value;
}
function _syncContentEditable(id, html) {
  const el = document.getElementById(id);
  if (el && el.innerHTML !== html) el.innerHTML = html;
}

function handleSpecialEditBlur(e) {
  const el = e.currentTarget;
  if (floatingToolbar && floatingToolbar._suppressBlur) return;
  if (el.getAttribute('contenteditable') !== 'true') return;
  if (el.innerHTML === el.dataset.originalContent) return;

  const kind = el.dataset.specialEditKind;
  const idx = el.dataset.specialEditIdx !== undefined ? Number(el.dataset.specialEditIdx) : null;
  const plain = _specialEditPlainText(el);
  const html = el.innerHTML;

  try {
    switch (kind) {
      case 'headerJobNumber':
        state.jobNumber = plain.trim();
        if (elements.jobNumber) elements.jobNumber.value = state.jobNumber;
        if (typeof updateHtmlCode === 'function') updateHtmlCode();
        break;
      case 'headerCompanyName':
        state.headerCompanyName = plain.trim();
        if (elements.headerCompanyName) elements.headerCompanyName.value = state.headerCompanyName;
        if (typeof updateHtmlCode === 'function') updateHtmlCode();
        break;
      case 'headerDate':
        state.headerDate = plain.trim();
        if (elements.headerDate) elements.headerDate.value = state.headerDate;
        if (typeof updateHtmlCode === 'function') updateHtmlCode();
        break;

      case 'kvJobCode':
        state.kv.jobCode = plain.trim();
        _syncInputValue('kv-job-code', state.kv.jobCode);
        break;
      case 'kvOrgName':
        state.kv.orgNameHtml = html;
        state.kv.orgName = plain;
        _syncContentEditable('kv-org-name', html);
        break;
      case 'kvTitle':
        state.kv.titleHtml = html;
        state.kv.title = plain;
        _syncContentEditable('kv-title', html);
        break;
      case 'kvDescription':
        state.kv.description = plain;
        _syncInputValue('kv-description', plain);
        break;
      case 'kvDescription2':
        state.kv.description2 = plain;
        _syncInputValue('kv-description2', plain);
        break;
      case 'kvDateCompany':
        state.kv.dateCompanyText = plain;
        _syncInputValue('kv-date-company', plain);
        break;

      case 'bottomButton':
        if (idx !== null && state.bottomButtons?.[idx]) {
          state.bottomButtons[idx].text = plain.trim();
          if (typeof renderBottomBtnList === 'function') renderBottomBtnList();
        }
        break;
    }

    el.dataset.originalContent = el.innerHTML;
    if (typeof saveSession === 'function') saveSession();
    if (typeof showSaveNotification === 'function') showSaveNotification();
  } catch (err) {
    console.error('[special-edit] save failed:', err);
  }
}

function removeSpecialInlineEditors() {
  const roots = [
    document.getElementById('kv-header-area'),
    document.getElementById('preview-content'),
  ].filter(Boolean);
  roots.forEach(root => {
    root.querySelectorAll('[data-special-editable-setup]').forEach(el => {
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-special-editable-setup');
      el.removeAttribute('data-special-edit-kind');
      el.removeAttribute('data-special-edit-idx');
      el.removeAttribute('data-original-content');
      el.removeEventListener('mousedown', handleSpecialEditMousedown);
      el.removeEventListener('blur',      handleSpecialEditBlur);
      el.removeEventListener('keydown',   handleSpecialEditKeydown);
    });
    root.querySelectorAll('a[data-edit-nav-block]').forEach(a => {
      a.removeAttribute('data-edit-nav-block');
      a.removeEventListener('click', _blockAnchorInEditMode);
    });
  });
}

/**
 * 클론된 DOM에서 편집 관련 속성/클래스 제거 (다운로드/복사 시 사용)
 */
function cleanEditingAttrs(clone) {
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('[data-editable-setup]').forEach(el => el.removeAttribute('data-editable-setup'));
  clone.querySelectorAll('.tbl-cell-selected').forEach(el => el.classList.remove('tbl-cell-selected'));
  clone.querySelectorAll('[data-original-content]').forEach(el => el.removeAttribute('data-original-content'));
  clone.querySelectorAll('.inline-edit-active').forEach(el => el.classList.remove('inline-edit-active'));
  clone.querySelectorAll('[data-spacer-setup]').forEach(el => el.removeAttribute('data-spacer-setup'));
  clone.querySelectorAll('[data-spacer-label]').forEach(el => el.removeAttribute('data-spacer-label'));
  // 특수 필드 편집용 속성 제거 (헤더/KV/버튼 인라인 편집)
  clone.querySelectorAll('[data-special-editable-setup]').forEach(el => el.removeAttribute('data-special-editable-setup'));
  clone.querySelectorAll('[data-special-edit-kind]').forEach(el => el.removeAttribute('data-special-edit-kind'));
  clone.querySelectorAll('[data-special-edit-idx]').forEach(el => el.removeAttribute('data-special-edit-idx'));
  clone.querySelectorAll('[data-edit-nav-block]').forEach(el => el.removeAttribute('data-edit-nav-block'));
  // 인트로 링크 오버레이: opacity 0.3 → 0 + 편집용 배경색 제거
  clone.querySelectorAll('.intro-link-overlay').forEach(el => {
    el.style.opacity = '0';
    el.style.background = 'none';
  });
  // 분리된 padding에 !important 추가 (외부 CSS 오버라이드 방지)
  // em 단위 padding(star-list-indent 등)은 건드리지 않음
  // 각 padding 선언을 개별적으로 판단 — 다른 속성의 !important나 다른 padding의 em 단위가 섞여 있어도 안전
  clone.querySelectorAll('[style*="padding"]').forEach(el => {
    const styleStr = el.getAttribute('style') || '';
    const updated = styleStr.replace(
      /padding(-top|-right|-bottom|-left)?\s*:\s*([^;]+?)(\s*!important)?(\s*;|$)/gi,
      (m, dir, val, bang, tail) => {
        const trimmedVal = val.trim();
        // em 단위는 보존 (star-list-indent 등 의도적 em 기반 padding)
        if (/^[\d.]+em\b/i.test(trimmedVal)) return m;
        // 이미 !important면 그대로 유지
        if (bang) return m;
        return `padding${dir || ''}: ${trimmedVal} !important${tail}`;
      }
    );
    if (updated !== styleStr) el.setAttribute('style', updated);
  });
}

/**
 * p 태그가 ul/ol을 직접 감싸는 잘못된 구조를 div로 교체
 * 브라우저 execCommand 또는 편집 중 생성된 <p><ul>...</ul></p> 패턴 정리
 */
function fixInvalidPWrap() {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;

  previewContent.querySelectorAll('p > ul, p > ol').forEach(list => {
    const p = list.parentElement;
    if (!p || p.tagName !== 'P') return;
    const div = document.createElement('div');
    if (p.style.cssText) div.style.cssText = p.style.cssText;
    if (p.className) div.className = p.className;
    if (p.dataset.editableSetup) div.dataset.editableSetup = p.dataset.editableSetup;
    // contenteditable / data-original-content 이어받기
    if (p.getAttribute('contenteditable')) div.setAttribute('contenteditable', p.getAttribute('contenteditable'));
    if (p.dataset.originalContent !== undefined) div.dataset.originalContent = p.dataset.originalContent;
    // innerHTML 대신 자식 노드를 직접 이동 → selection range가 detached되지 않음
    while (p.firstChild) div.appendChild(p.firstChild);
    p.parentNode.replaceChild(div, p);
  });
}

function removeInlineEditors() {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;

  const editableElements = previewContent.querySelectorAll('[data-editable-setup]');
  editableElements.forEach(el => {
    el.removeAttribute('contenteditable');
    el.removeAttribute('data-editable-setup');
    el.removeAttribute('data-original-content');
    el.removeEventListener('mousedown', handleEditableClick);
    el.removeEventListener('blur', handleEditableBlur);
    el.removeEventListener('keydown', handleEditableKeydown);
  });

  // 특수 필드 (헤더 / KV 카드 / 하단 버튼) 편집 설정 해제
  removeSpecialInlineEditors();

  // ul/ol 등 data-editable-setup 없이 붙은 contenteditable/data-original-content 잔여분 제거
  previewContent.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  previewContent.querySelectorAll('[data-original-content]').forEach(el => el.removeAttribute('data-original-content'));

  // spacer label 정리
  previewContent.querySelectorAll('[data-spacer-label]').forEach(el => {
    el.removeAttribute('data-spacer-label');
  });
  hideSpacerToolbar();
  document.getElementById('spacer-insert-btn')?.remove();
  document.getElementById('spacer-insert-picker')?.remove();
  document.getElementById('border-picker')?.remove();
  if (_multiSelect.active) exitMultiSelectMode();

  // 이벤트 위임 핸들러 제거
  if (previewContent._spacerClickHandler) {
    previewContent.removeEventListener('click',     previewContent._spacerClickHandler);
    previewContent.removeEventListener('mouseover', previewContent._spacerMoveHandler);
    previewContent.removeEventListener('mouseleave', previewContent._spacerLeaveHandler);
    delete previewContent._spacerClickHandler;
    delete previewContent._spacerMoveHandler;
    delete previewContent._spacerLeaveHandler;
  }

  // 다중 선택 핸들러 제거
  if (previewContent._multiSelectHandler) {
    previewContent.removeEventListener('mousemove', previewContent._multiSelectHandler);
    document.removeEventListener('mouseup', previewContent._multiSelectEndHandler);
    delete previewContent._multiSelectHandler;
    delete previewContent._multiSelectEndHandler;
  }
  _multiLineSelect.isDragging = false;
  _multiLineSelect.dragStartElement = null;
}

function handleEditableClick(e) {
  const el = e.currentTarget;

  // ★ preventDefault는 임계값 초과 후에만 호출 (부분 선택 허용)
  // e.preventDefault();  // → mousemove에서 조건부 호출로 변경

  // 드래그 선택 시작
  _multiLineSelect.isDragging = true;
  _multiLineSelect.dragStartElement = el;
  _multiLineSelect.dragStartX = e.clientX;
  _multiLineSelect.dragStartY = e.clientY;
  _multiLineSelect.dragThresholdMet = false;

  // 원본 클릭 지점의 caret 기억 (cross-element 드래그 시 정확한 시작 위치 유지)
  const caret = _getCaretAtPoint(e.clientX, e.clientY);
  if (caret) {
    _multiLineSelect.dragStartCaretNode = caret.node;
    _multiLineSelect.dragStartCaretOffset = caret.offset;
  } else {
    _multiLineSelect.dragStartCaretNode = null;
    _multiLineSelect.dragStartCaretOffset = 0;
  }

  // undo 스냅샷 저장
  editHistory.push();
  if (!el.dataset.originalContent) {
    el.dataset.originalContent = el.innerHTML;
  }

  // 명시적 focus 설정 (preventDefault 후에도 필요)
  el.focus();
  // 브라우저가 네이티브 클릭으로 caret을 놓도록 selection은 건들지 않음
  // (sel.removeAllRanges()를 호출하지 않아야 실제 클릭 지점에서 드래그 시작 가능)
}

function handleEditableBlur(e) {
  const el = e.currentTarget;
  const targetEl = el;

  // 색상 피커 등 플로팅 툴바 조작 중에는 blur 무시
  if (floatingToolbar._suppressBlur) return;

  if (targetEl.getAttribute('contenteditable') !== 'true') return;

  // contenteditable 유지 (편집 모드 중에는 모든 요소가 contenteditable)
  // 변경 사항이 있으면 state 업데이트 + 다음 undo 기준점 갱신
  if (targetEl.innerHTML !== targetEl.dataset.originalContent) {
    saveInlineEdits();
    targetEl.dataset.originalContent = targetEl.innerHTML;
  }
}

function handleEditableKeydown(e) {
  const el = e.currentTarget;

  if (e.key === 'Enter' && e.shiftKey) {
    // 블록 끝에서 BR을 수동 삽입하면 브라우저가 렌더를 안 하는 trailing-BR 이슈 때문에
    // 두 번 눌러야 줄바꿈이 보이던 버그가 있었음. execCommand('insertLineBreak')는
    // 필요한 sentinel BR을 자동 추가하여 한 번에 렌더됨.
    e.preventDefault();
    document.execCommand('insertLineBreak');
  } else if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    el.blur();
  } else if (e.key === 'Escape') {
    // 원본 내용으로 복구 (contenteditable 유지)
    if (el.dataset.originalContent) {
      el.innerHTML = el.dataset.originalContent;
    }
    el.blur();
  }
}

/**
 * 선택 범위 내 텍스트 노드 목록 반환 (cross-element 지원)
 */
function getTextNodesInRange(range) {
  const result = [];
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return result;
  const walker = document.createTreeWalker(previewContent, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    if (!range.intersectsNode(node)) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end   = node === range.endContainer   ? range.endOffset   : node.length;
    if (start < end) result.push({ node, start, end });
  }
  return result;
}

/**
 * 선택된 텍스트를 span으로 감싸 인라인 스타일 적용 (cross-element 지원)
 * @param {string} styleProperty  CSS property name (camelCase)
 * @param {string} styleValue     CSS value
 * @returns {boolean} 적용 성공 여부
 */
/**
 * Bold 토글: <strong>, <b> 태그와 inline style 모두 처리
 */
function toggleUnderlineFormat() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return false;

  const walker = document.createTreeWalker(previewContent, NodeFilter.SHOW_ELEMENT, null);
  let node;
  const uElements = [];
  const spanWithUnderline = [];

  while ((node = walker.nextNode())) {
    if (range.intersectsNode(node)) {
      if (node.tagName === 'U') {
        uElements.push(node);
      }
      if (node.tagName === 'SPAN' && node.style.textDecoration === 'underline') {
        spanWithUnderline.push(node);
      }
    }
  }

  const isUnderline = uElements.length > 0 || spanWithUnderline.length > 0;

  if (isUnderline) {
    // 밑줄 제거: <u> 태그 unwrap + inline style 제거
    uElements.forEach(el => {
      while (el.firstChild) {
        el.parentNode.insertBefore(el.firstChild, el);
      }
      el.remove();
    });
    spanWithUnderline.forEach(span => {
      span.style.textDecoration = '';
      if (!span.style.cssText.trim()) {
        while (span.firstChild) {
          span.parentNode.insertBefore(span.firstChild, span);
        }
        span.remove();
      }
    });
  } else {
    // 밑줄 추가
    applySpanFormat('textDecoration', 'underline');
    return true;
  }

  saveInlineEdits();
  updateHtmlCode();
  return true;
}

function toggleBoldFormat() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return false;

  // 범위 내 모든 <strong>, <b>, fontWeight style 찾기
  const walker = document.createTreeWalker(
    previewContent,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  let node;
  const strongElements = [];
  const spanWithBold = [];

  while ((node = walker.nextNode())) {
    if (range.intersectsNode(node)) {
      if (node.tagName === 'STRONG' || node.tagName === 'B') {
        strongElements.push(node);
      }
      if (node.tagName === 'SPAN' && node.style.fontWeight === 'bold') {
        spanWithBold.push(node);
      }
    }
  }

  // bold 상태 확인 (강 태그나 bold 스타일이 있으면 제거, 없으면 추가)
  const isBold = strongElements.length > 0 || spanWithBold.length > 0;

  if (isBold) {
    // Bold 제거: <strong>, <b> 태그 unwrap + inline style 제거
    strongElements.forEach(el => {
      while (el.firstChild) {
        el.parentNode.insertBefore(el.firstChild, el);
      }
      el.remove();
    });
    spanWithBold.forEach(span => {
      span.style.fontWeight = '';
      if (!span.style.cssText.trim()) {
        while (span.firstChild) {
          span.parentNode.insertBefore(span.firstChild, span);
        }
        span.remove();
      }
    });
  } else {
    // Bold 추가: <span style="font-weight: bold;">로 감싸기
    const nodes = getTextNodesInRange(range);
    const appliedSpans = [];
    nodes.forEach(({ node, start, end }) => {
      const before   = node.textContent.slice(0, start);
      const selected = node.textContent.slice(start, end);
      const after    = node.textContent.slice(end);

      const span = document.createElement('span');
      span.style.fontWeight = 'bold';
      span.textContent = selected;
      appliedSpans.push(span);

      const frag = document.createDocumentFragment();
      if (before)   frag.appendChild(document.createTextNode(before));
      frag.appendChild(span);
      if (after)    frag.appendChild(document.createTextNode(after));
      node.parentNode.replaceChild(frag, node);
    });
  }

  saveInlineEdits();
  updateHtmlCode();
  return true;
}

function applySpanFormat(styleProperty, styleValue) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);

  const previewContent = document.getElementById('preview-content');
  if (!previewContent || !previewContent.contains(range.commonAncestorContainer)) return false;

  // 항상 텍스트 노드 방식으로 처리 — 선택 영역에만 정확히 적용
  const nodes = getTextNodesInRange(range);
  if (!nodes.length) return false;

  const appliedSpans = [];

  nodes.forEach(({ node, start, end }) => {
    // 텍스트 노드 전체가 선택되고 부모가 SPAN이면 부모에 스타일 직접 적용 (중복 래핑 방지)
    if (start === 0 && end === node.length && node.parentElement?.tagName === 'SPAN') {
      node.parentElement.style[styleProperty] = styleValue;
      appliedSpans.push(node.parentElement);
      return;
    }

    const before   = node.textContent.slice(0, start);
    const selected = node.textContent.slice(start, end);
    const after    = node.textContent.slice(end);

    const span = document.createElement('span');
    span.style[styleProperty] = styleValue;
    span.textContent = selected;
    appliedSpans.push(span);

    const frag = document.createDocumentFragment();
    if (before)   frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after)    frag.appendChild(document.createTextNode(after));
    node.parentNode.replaceChild(frag, node);
  });

  saveInlineEdits();
  updateHtmlCode();

  // 적용 후 선택 복원
  if (appliedSpans.length > 0) {
    try {
      const firstSpan = appliedSpans[0];
      const lastSpan = appliedSpans[appliedSpans.length - 1];

      const firstNode = getFirstTextNode(firstSpan) || firstSpan.firstChild;
      const lastNode = getLastTextNode(lastSpan) || lastSpan.lastChild;

      if (firstNode && lastNode) {
        const newRange = document.createRange();
        newRange.setStart(firstNode, 0);

        const lastLength = lastNode.nodeType === Node.TEXT_NODE ? lastNode.length : lastNode.textContent.length;
        newRange.setEnd(lastNode, lastLength);

        sel.removeAllRanges();
        sel.addRange(newRange);

        // ★ floatingToolbar의 currentSelection 갱신 (다음 스타일 적용용)
        if (floatingToolbar && sel.rangeCount > 0) {
          floatingToolbar.currentSelection = sel.getRangeAt(0).cloneRange();
        }
      }
    } catch (e) {}
  }

  return true;
}

function saveInlineEdits() {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;

  // 스냅샷은 편집 시작(handleEditableClick) 또는 주요 동작(pushMajor) 시점에 저장
  // saveInlineEdits는 state 동기화만 담당
  editHistory._isMajorOp = false;

  // 현재 preview-content의 innerHTML을 state에 저장
  // template wrapper를 제거하고 순수 콘텐츠만 추출

  // v3 템플릿(standard, pass_fail 등): #templwrap_v3 .templ_content 안의 내용만 추출
  const templContent = previewContent.querySelector('#templwrap_v3 .templ_content');
  if (templContent) {
    const clone = templContent.cloneNode(true);
    cleanEditingAttrs(clone);
    state.convertedHtml = clone.innerHTML;
  } else {
    // 기타 템플릿: .jobpost-content/.jp-sec 기반 추출
    const sections = previewContent.querySelectorAll('.jp-sec');
    if (sections.length > 0) {
      let combinedHtml = '';
      sections.forEach(sec => { combinedHtml += sec.outerHTML; });
      state.convertedHtml = combinedHtml;
    } else {
      state.convertedHtml = previewContent.innerHTML;
    }
  }

  // HTML 코드 뷰 업데이트
  if (state.activeView === 'code' || state.activeView === 'split') {
    updateHtmlCode();
  }

  // 저장 피드백 표시
  showSaveNotification();
}

function showEditModeBanner() {
  const templatePreview = document.getElementById('template-preview');
  if (!templatePreview) return;

  // 기존 배너 제거
  hideEditModeBanner();

  const banner = document.createElement('div');
  banner.className = 'edit-mode-banner';
  banner.id = 'edit-mode-banner';
  banner.innerHTML = `
    <span class="edit-icon">✏️</span>
    <span>편집 모드 - 텍스트를 클릭하여 직접 수정하세요</span>
  `;

  templatePreview.insertBefore(banner, templatePreview.firstChild);
}

// ─── 테두리(border) 피커 ─────────────────────────────────────────────────
const _borderPicker = { target: null, style: 'solid', width: '1', color: '#333333', padding: '0', bgColor: '' };

function findBorderTarget(range) {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return null;
  let node = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const BLOCK_TAGS = new Set(['P','DIV','UL','OL','LI','TD','TH','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','SECTION']);
  while (node && node !== previewContent) {
    if (BLOCK_TAGS.has(node.tagName)) return node;
    node = node.parentElement;
  }
  return null;
}

// 선택 범위 내 형제 노드들을 새 <div>로 감싸기
// 반환값: 생성된 wrapper div (이미 단일 블록이면 null)
function wrapSelectionInDiv(range) {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent || !range) return null;

  // 공통 부모 찾기
  let ancestor = range.commonAncestorContainer;
  if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentElement;
  if (!previewContent.contains(ancestor)) return null;

  // 선택 시작/끝이 속한 ancestor의 직계 자식 노드 찾기
  const getDirectChild = (node) => {
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node.parentElement !== ancestor) node = node.parentElement;
    return node;
  };

  const startChild = getDirectChild(range.startContainer);
  const endChild   = getDirectChild(range.endContainer);

  // 이미 같은 노드이거나 찾지 못하면 wrapping 불필요
  if (!startChild || !endChild || startChild === endChild) return null;

  const allChildren = Array.from(ancestor.childNodes);
  const startIdx = allChildren.indexOf(startChild);
  const endIdx   = allChildren.indexOf(endChild);
  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) return null;

  // startChild~endChild 범위의 노드를 새 div로 이동
  const toWrap = allChildren.slice(startIdx, endIdx + 1);
  const wrapper = document.createElement('div');
  ancestor.insertBefore(wrapper, startChild);
  toWrap.forEach(node => wrapper.appendChild(node));

  return wrapper;
}

function applyBorderFromPicker() {
  if (!_borderPicker.target) return;
  const el = _borderPicker.target;
  // 기존 cssText에서 border/padding/background-color 제거 후 한번에 재설정
  let css = el.style.cssText
    .replace(/border[^;]*;?\s*/g, '')
    .replace(/padding[^;]*;?\s*/g, '')
    .replace(/background-color[^;]*;?\s*/g, '')
    .trim();
  css += ` border: ${_borderPicker.width}px ${_borderPicker.style} ${_borderPicker.color};`;
  const p = _borderPicker.padding;
  if (p && p !== '0') css += ` padding: ${p}px !important;`;
  if (_borderPicker.bgColor) css += ` background-color: ${_borderPicker.bgColor};`;
  el.style.cssText = css;
  floatingToolbar.afterCommand?.();
}

function showBorderPicker(btn, presetTarget = null) {
  const existing = document.getElementById('border-picker');
  if (existing) { existing.remove(); return; }

  let target = presetTarget;
  if (!target) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // 다중 형제 노드 선택 → div로 감싸서 target으로 사용
    // 단일 블록 선택 → 해당 블록을 target으로 사용
    target = wrapSelectionInDiv(range) ?? findBorderTarget(range);
    if (!target) return;
  }
  _borderPicker.target = target;

  // 기존 border / padding 파싱
  const cur = target.style.border || '';
  const m = cur.match(/(\d+)px\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))/);
  if (m) { _borderPicker.width = m[1]; _borderPicker.style = m[2]; _borderPicker.color = m[3]; }
  const curPad = parseInt(target.style.padding || target.style.paddingTop || target.style.paddingLeft) || 0;
  _borderPicker.padding = String(curPad);
  _borderPicker.bgColor = target.style.backgroundColor || '';

  const COLORS = ['#333333','#666666','#aaaaaa','#cc3300','#1a5cc8','#008844'];
  const PADDINGS = ['0','4','8','12','16'];

  const picker = document.createElement('div');
  picker.id = 'border-picker';
  picker.className = 'border-picker';
  picker.innerHTML = `
    <div class="border-picker-section-label">선 종류</div>
    <div class="border-picker-row border-picker-styles">
      <button data-bstyle="solid"  class="${_borderPicker.style==='solid' ?'active':''}">━ solid</button>
      <button data-bstyle="dashed" class="${_borderPicker.style==='dashed'?'active':''}">╌ dashed</button>
      <button data-bstyle="dotted" class="${_borderPicker.style==='dotted'?'active':''}">⋯ dotted</button>
    </div>
    <div class="border-picker-section-label">굵기</div>
    <div class="border-picker-row border-picker-widths">
      <button data-bwidth="1" class="${_borderPicker.width==='1'?'active':''}">1px</button>
      <button data-bwidth="2" class="${_borderPicker.width==='2'?'active':''}">2px</button>
      <button data-bwidth="3" class="${_borderPicker.width==='3'?'active':''}">3px</button>
    </div>
    <div class="border-picker-section-label">테두리 색상</div>
    <div class="border-picker-row border-picker-colors">
      ${COLORS.map(c=>`<button data-bcolor="${c}" style="background:${c}" class="${_borderPicker.color===c?'active':''}"></button>`).join('')}
      <label class="bp-color-custom-wrap" title="직접 선택">
        <input type="color" id="bp-color-custom" value="${_borderPicker.color.startsWith('#') ? _borderPicker.color : '#333333'}">
        <span class="bp-color-custom-icon">🎨</span>
      </label>
    </div>
    <div class="border-picker-section-label">배경색</div>
    <div class="border-picker-row border-picker-bgcolor-row">
      <label class="bp-color-custom-wrap" title="배경색 선택">
        <input type="color" id="bp-bgcolor-custom" value="${_borderPicker.bgColor && _borderPicker.bgColor.startsWith('#') ? _borderPicker.bgColor : '#ffffff'}">
        <span class="bp-color-custom-icon">🎨</span>
      </label>
      <span class="bp-bgcolor-preview" id="bp-bgcolor-preview" style="background:${_borderPicker.bgColor||'transparent'}"></span>
      <button class="bp-bgcolor-clear" id="bp-bgcolor-clear">없음</button>
    </div>
    <div class="border-picker-section-label">내부 여백</div>
    <div class="border-picker-row border-picker-paddings">
      ${PADDINGS.map(p=>`<button data-bpad="${p}" class="${_borderPicker.padding===p?'active':''}">${p==='0'?'없음':p+'px'}</button>`).join('')}
    </div>
    <button class="border-picker-remove">테두리 제거</button>
  `;

  // 위치
  const rect = btn.getBoundingClientRect();
  picker.style.top  = (rect.bottom + 6) + 'px';
  picker.style.left = Math.min(rect.left, window.innerWidth - 230) + 'px';
  document.body.appendChild(picker);

  picker.querySelectorAll('[data-bstyle]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    _borderPicker.style = b.dataset.bstyle;
    picker.querySelectorAll('[data-bstyle]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    applyBorderFromPicker();
  }));
  picker.querySelectorAll('[data-bwidth]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    _borderPicker.width = b.dataset.bwidth;
    picker.querySelectorAll('[data-bwidth]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    applyBorderFromPicker();
  }));
  picker.querySelectorAll('[data-bcolor]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    _borderPicker.color = b.dataset.bcolor;
    picker.querySelectorAll('[data-bcolor]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    picker.querySelector('#bp-color-custom').value = _borderPicker.color.startsWith('#') ? _borderPicker.color : '#333333';
    applyBorderFromPicker();
  }));
  // 테두리 컬러피커
  picker.querySelector('#bp-color-custom').addEventListener('input', e => {
    e.stopPropagation();
    _borderPicker.color = e.target.value;
    picker.querySelectorAll('[data-bcolor]').forEach(x => x.classList.remove('active'));
    applyBorderFromPicker();
  });
  // 배경색 컬러피커
  picker.querySelector('#bp-bgcolor-custom').addEventListener('input', e => {
    e.stopPropagation();
    _borderPicker.bgColor = e.target.value;
    picker.querySelector('#bp-bgcolor-preview').style.background = _borderPicker.bgColor;
    applyBorderFromPicker();
  });
  // 배경색 없음
  picker.querySelector('#bp-bgcolor-clear').addEventListener('click', e => {
    e.stopPropagation();
    _borderPicker.bgColor = '';
    picker.querySelector('#bp-bgcolor-preview').style.background = 'transparent';
    picker.querySelector('#bp-bgcolor-custom').value = '#ffffff';
    applyBorderFromPicker();
  });
  picker.querySelectorAll('[data-bpad]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    _borderPicker.padding = b.dataset.bpad;
    picker.querySelectorAll('[data-bpad]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    applyBorderFromPicker();
  }));
  picker.querySelector('.border-picker-remove').addEventListener('click', e => {
    e.stopPropagation();
    if (_borderPicker.target) {
      _borderPicker.target.style.border = '';
      _borderPicker.target.style.padding = '';
      _borderPicker.target.style.backgroundColor = '';
      floatingToolbar.afterCommand?.();
    }
    picker.remove();
    document.removeEventListener('mousedown', onOutside);
  });

  const onOutside = (e) => {
    if (!picker.contains(e.target) && e.target !== btn) {
      picker.remove();
      document.removeEventListener('mousedown', onOutside);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onOutside), 0);
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── 멀티 선택 모드 ───────────────────────────────────────────────────────────
const _multiSelect = { active: false, items: [], bar: null, btn: null, handler: null };

function enterMultiSelectMode(btn) {
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;
  _multiSelect.active = true;
  _multiSelect.items = [];
  _multiSelect.btn = btn;
  previewContent.classList.add('multi-select-mode');

  // 클릭 핸들러 (캡처 단계 — contenteditable 이벤트보다 먼저 처리)
  const handler = (e) => {
    if (!_multiSelect.active) return;
    const BLOCK_TAGS = ['P','H1','H2','H3','H4','LI','TD','TH','DIV','TABLE','UL','OL'];
    // 클릭한 위치에서 가장 가까운 블록 요소 찾기
    let el = e.target;
    while (el && el !== previewContent) {
      if (BLOCK_TAGS.includes(el.tagName)) break;
      el = el.parentElement;
    }
    if (!el || el === previewContent) return;

    // li 클릭 → 부모 ul/ol 선택 (li를 div로 빼면 목록 구조가 깨짐)
    if (el.tagName === 'LI') {
      const listParent = el.closest('ul, ol');
      if (listParent && previewContent.contains(listParent)) el = listParent;
    }
    // 테이블 내부 요소 클릭(td/th/tr/p/div 등) → .table_x 래퍼 선택
    // (td 안의 p·div에서 루프가 멈춰 table 선택이 안 되는 문제 해결)
    if (el.tagName !== 'TABLE') {
      const tableParent = el.closest('table');
      if (tableParent && previewContent.contains(tableParent)) {
        const tableX = tableParent.closest('.table_x');
        el = (tableX && previewContent.contains(tableX)) ? tableX : tableParent;
      }
    } else {
      // TABLE 자체가 el인 경우에도 .table_x로 올리기
      const tableX = el.closest('.table_x');
      if (tableX && previewContent.contains(tableX)) el = tableX;
    }

    e.preventDefault();
    e.stopPropagation();
    toggleMultiSelectItem(el);
  };
  _multiSelect.handler = handler;
  previewContent.addEventListener('click', handler, true);

  // 바 표시
  _showMultiSelectBar();
}

function exitMultiSelectMode() {
  const previewContent = document.getElementById('preview-content');
  _multiSelect.active = false;
  if (previewContent) {
    previewContent.classList.remove('multi-select-mode');
    if (_multiSelect.handler) {
      previewContent.removeEventListener('click', _multiSelect.handler, true);
    }
  }
  _multiSelect.items.forEach(el => el.classList.remove('multi-select-item'));
  _multiSelect.items = [];
  _multiSelect.handler = null;
  if (_multiSelect.bar) { _multiSelect.bar.remove(); _multiSelect.bar = null; }
}

function toggleMultiSelectItem(el) {
  const idx = _multiSelect.items.indexOf(el);
  if (idx >= 0) {
    el.classList.remove('multi-select-item');
    _multiSelect.items.splice(idx, 1);
  } else {
    el.classList.add('multi-select-item');
    _multiSelect.items.push(el);
  }
  _updateMultiSelectBar();
}

function _showMultiSelectBar() {
  if (_multiSelect.bar) _multiSelect.bar.remove();
  const bar = document.createElement('div');
  bar.className = 'multi-select-bar';
  bar.id = 'multi-select-bar';
  bar.innerHTML = `
    <span class="multi-select-bar-count">0개 선택됨</span>
    <button class="multi-select-bar-apply" disabled>테두리 적용</button>
    <button class="multi-select-bar-cancel">취소</button>
  `;
  bar.querySelector('.multi-select-bar-apply').addEventListener('click', () => {
    applyBorderToMultiSelection();
  });
  bar.querySelector('.multi-select-bar-cancel').addEventListener('click', () => {
    exitMultiSelectMode();
  });
  document.body.appendChild(bar);
  _multiSelect.bar = bar;
}

function _updateMultiSelectBar() {
  if (!_multiSelect.bar) return;
  const count = _multiSelect.items.length;
  _multiSelect.bar.querySelector('.multi-select-bar-count').textContent = `${count}개 선택됨`;
  const applyBtn = _multiSelect.bar.querySelector('.multi-select-bar-apply');
  applyBtn.disabled = count === 0;
}

function applyBorderToMultiSelection() {
  if (_multiSelect.items.length === 0) return;
  const previewContent = document.getElementById('preview-content');
  if (!previewContent) return;

  let wrapper;
  if (_multiSelect.items.length === 1) {
    // 단일 요소: 그 요소 자체에 테두리
    wrapper = _multiSelect.items[0];
    wrapper.classList.remove('multi-select-item');
  } else {
    // 여러 요소: DOM 순서로 정렬 후 공통 부모의 자식들을 div로 감싸기
    const sorted = [..._multiSelect.items].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    sorted.forEach(el => el.classList.remove('multi-select-item'));

    // 공통 부모 찾기
    let parent = sorted[0].parentElement;
    // 모든 선택 요소가 같은 부모 아래에 있는지 확인
    const sameParent = sorted.every(el => el.parentElement === parent);

    if (sameParent) {
      wrapper = document.createElement('div');
      parent.insertBefore(wrapper, sorted[0]);
      sorted.forEach(el => wrapper.appendChild(el));
    } else {
      // 공통 조상 기준으로 처리 — 첫 번째 요소 부모에 div 생성
      wrapper = document.createElement('div');
      parent.insertBefore(wrapper, sorted[0]);
      sorted.forEach(el => wrapper.appendChild(el));
    }
  }

  _multiSelect.items = [];
  exitMultiSelectMode();

  // border-picker 표시 (wrapper를 target으로 설정)
  const borderBtn = document.querySelector('[data-cmd="border"]');
  showBorderPicker(borderBtn, wrapper);
}
// ─────────────────────────────────────────────────────────────────────────────

// <br>로 구분된 블록을 개별 블록으로 분리 (실제 노드 이동, 선택 범위 유지됨)
function splitBlockAtBr(block) {
  const tag = block.tagName.toLowerCase();
  const children = Array.from(block.childNodes);
  const segments = [[]];

  children.forEach(node => {
    if (node.nodeName === 'BR') {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(node);
    }
  });

  const nonEmpty = segments.filter(s => s.length > 0);
  if (nonEmpty.length <= 1) return [block]; // 분리할 필요 없음

  const parent = block.parentNode;
  const newBlocks = nonEmpty.map(nodes => {
    const el = document.createElement(tag);
    el.style.cssText = block.style.cssText;
    el.className = block.className;
    nodes.forEach(n => el.appendChild(n)); // 실제 노드 이동 (clone 아님 → range 유효)
    return el;
  });

  newBlocks.forEach(nb => parent.insertBefore(nb, block));
  parent.removeChild(block);
  return newBlocks;
}

// TD/TH 전용: <br> 줄 단위로 선택 범위에 해당하는 줄만 span.hanging-indent-wrap으로 감싸기
// (splitBlockAtBr를 쓰면 새 <td>가 생겨 테이블 구조가 깨지므로 내부에서만 처리)
function applyHangingIndentToCell(cell, range) {
  const children = Array.from(cell.childNodes);

  // <br> 기준으로 줄 그룹 분리
  const lineGroups = [[]];
  children.forEach(node => {
    if (node.nodeName === 'BR') lineGroups.push([]);
    else lineGroups[lineGroups.length - 1].push(node);
  });

  lineGroups.forEach(nodes => {
    if (!nodes.length) return;

    // 선택 범위와 교차하는 줄만 처리
    const inSel = nodes.some(n => { try { return range.intersectsNode(n); } catch(e) { return false; } });
    if (!inSel) return;

    // 이미 감싸진 경우 → 토글 해제
    if (nodes.length === 1 && nodes[0].nodeName === 'SPAN' &&
        nodes[0].classList.contains('hanging-indent-wrap')) {
      const wrap = nodes[0];
      while (wrap.firstChild) wrap.parentNode.insertBefore(wrap.firstChild, wrap);
      wrap.remove();
      return;
    }

    // 이 줄의 텍스트에서 첫 공백까지 폭 측정
    const lineText = nodes.map(n => n.textContent).join('');
    const idx = lineText.search(/\s/);
    const prefix = idx > 0 ? lineText.slice(0, idx + 1) : '';
    let em = 1;
    if (prefix) {
      const cs = getComputedStyle(cell);
      const probe = document.createElement('span');
      probe.style.cssText = `visibility:hidden;position:absolute;white-space:pre;` +
        `font-size:${cs.fontSize};font-family:${cs.fontFamily};` +
        `font-weight:${cs.fontWeight};letter-spacing:${cs.letterSpacing};`;
      probe.textContent = prefix;
      document.body.appendChild(probe);
      const px = probe.getBoundingClientRect().width;
      document.body.removeChild(probe);
      const fs = parseFloat(cs.fontSize);
      if (fs > 0) em = Math.round((px / fs) * 100) / 100;
    }

    // 이 줄의 노드들을 span으로 감싸기 (삽입 위치를 미리 캡처)
    const insertBefore = nodes[nodes.length - 1].nextSibling;
    const wrap = document.createElement('span');
    wrap.className = 'hanging-indent-wrap';
    wrap.style.cssText = `display:block;padding-left:${em}em;text-indent:${-em}em;`;
    nodes.forEach(n => wrap.appendChild(n));
    cell.insertBefore(wrap, insertBefore);
  });
}

function hideEditModeBanner() {
  const banner = document.getElementById('edit-mode-banner');
  if (banner) {
    banner.remove();
  }
}

// ---- Spacer (여백 div) 편집 툴바 ----

function handleSpacerClick(e) {
  e.stopPropagation();
  showSpacerToolbar(e.currentTarget);
}

function hideSpacerToolbar() {
  const existing = document.getElementById('spacer-toolbar');
  if (existing) existing.remove();
}

function showSpacerToolbar(el) {
  hideSpacerToolbar();

  const currentCls = [...el.classList].find(c => /^h[1-4]0$/.test(c)) || 'h20';

  const toolbar = document.createElement('div');
  toolbar.id = 'spacer-toolbar';
  toolbar.className = 'spacer-toolbar';
  toolbar.innerHTML = `
    <button data-h="h10" class="${currentCls === 'h10' ? 'active' : ''}">h10</button>
    <button data-h="h20" class="${currentCls === 'h20' ? 'active' : ''}">h20</button>
    <button data-h="h30" class="${currentCls === 'h30' ? 'active' : ''}">h30</button>
    <button data-h="h40" class="${currentCls === 'h40' ? 'active' : ''}">h40</button>
    <div class="spacer-divider"></div>
    <button class="spacer-delete">삭제</button>
  `;

  document.body.appendChild(toolbar);

  // 위치: spacer 중앙 상단
  const rect = el.getBoundingClientRect();
  const tbRect = toolbar.getBoundingClientRect();
  let top = rect.top - tbRect.height - 6;
  let left = rect.left + (rect.width - tbRect.width) / 2;
  if (top < 4) top = rect.bottom + 4;
  left = Math.max(4, Math.min(left, window.innerWidth - tbRect.width - 4));
  toolbar.style.top = top + 'px';
  toolbar.style.left = left + 'px';

  // 높이 변경
  toolbar.querySelectorAll('button[data-h]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newH = btn.dataset.h;
      el.classList.remove('h10', 'h20', 'h30', 'h40');
      el.classList.add(newH);
      el.dataset.spacerLabel = newH;
      toolbar.querySelectorAll('button[data-h]').forEach(b => b.classList.toggle('active', b.dataset.h === newH));
      editHistory.push();
      saveInlineEdits();
    });
  });

  // 외부 클릭 시 닫기
  const onOutside = (e) => {
    if (!toolbar.contains(e.target) && e.target !== el) {
      hideSpacerToolbar();
      document.removeEventListener('click', onOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', onOutside), 0);

  // 삭제
  toolbar.querySelector('.spacer-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    document.removeEventListener('click', onOutside);
    el.remove();
    hideSpacerToolbar();
    editHistory.push();
    saveInlineEdits();
  });
}

// ---- Spacer 삽입 "+" 버튼 (블록 hover) ----

// 전역 spacer hover 상태 (핸들러 중복 방지)
const _spacerHover = { target: null, hideTimer: null, btn: null };

function setupSpacerInsertHover(previewContent) {
  // 기존 이벤트 리스너 제거 (updatePreview 재호출 시 핸들러 중복 방지)
  if (previewContent._spacerClickHandler) {
    previewContent.removeEventListener('click',     previewContent._spacerClickHandler);
    previewContent.removeEventListener('mouseover', previewContent._spacerMoveHandler);
    previewContent.removeEventListener('mouseleave', previewContent._spacerLeaveHandler);
    delete previewContent._spacerClickHandler;
    delete previewContent._spacerMoveHandler;
    delete previewContent._spacerLeaveHandler;
  }
  // _spacerHover.target 초기화 (이전 target 참조가 신규 핸들러의 showBtn 진입을 막지 않도록)
  _spacerHover.target = null;
  document.getElementById('spacer-insert-btn')?.remove();
  const insertBtn = document.createElement('div');
  insertBtn.id = 'spacer-insert-btn';
  insertBtn.className = 'spacer-insert-btn';
  insertBtn.innerHTML = '+ 여백 추가';
  document.body.appendChild(insertBtn);
  _spacerHover.btn = insertBtn;

  /**
   * hover/클릭된 요소에서 spacer 삽입에 적합한 블록 요소를 찾아 반환.
   * - 테이블 안 요소 → 테이블 자체를 반환
   * - p/ul/ol/spacer → 그대로 반환
   * - .sec_wrap/.jp-sec → 그대로 반환
   * previewContent 바깥이거나 previewContent 자신이면 null
   */
  const getInsertTarget = (el) => {
    if (!el || !previewContent.contains(el) || el === previewContent) return null;
    // 테이블 안은 무시
    if (el.closest('table')) return null;
    // 매칭 가능한 블록 셀렉터 (h1~h4 포함 — 없으면 .jp-sec 전체가 잡혀 버튼이 뷰포트 밖으로 밀림)
    const block = el.closest('h1, h2, h3, h4, p, ul, ol, .sec_wrap, .jp-sec, div.h10, div.h20, div.h30, div.h40');
    if (block && previewContent.contains(block) && block !== previewContent) return block;
    return null;
  };

  const showBtn = (blockEl) => {
    clearTimeout(_spacerHover.hideTimer);
    _spacerHover.target = blockEl;
    insertBtn._spacerTarget = blockEl;
    const rect = blockEl.getBoundingClientRect();
    const top = Math.min(rect.bottom - 14, window.innerHeight - 28);
    insertBtn.style.top  = Math.max(4, top) + 'px';
    insertBtn.style.left = (rect.left + rect.width / 2) + 'px';
    insertBtn.classList.add('visible');
  };

  const hideBtn = () => {
    _spacerHover.hideTimer = setTimeout(() => {
      insertBtn.classList.remove('visible');
      _spacerHover.target = null;
    }, 200);
  };

  // ① spacer 클릭 이벤트 위임 (삭제/높이 변경 툴바)
  previewContent._spacerClickHandler = (e) => {
    if (!state.editMode) return;
    const spacer = e.target.closest('div.h10, div.h20, div.h30, div.h40');
    if (!spacer || !previewContent.contains(spacer)) return;
    e.stopPropagation();
    showSpacerToolbar(spacer);
  };

  // ② hover로 "+ 여백 추가" 버튼 위치 갱신
  previewContent._spacerMoveHandler = (e) => {
    if (!state.editMode) return;
    const target = getInsertTarget(e.target);
    if (!target) { hideBtn(); return; }
    if (target !== _spacerHover.target) showBtn(target);
  };
  previewContent._spacerLeaveHandler = () => hideBtn();

  previewContent.addEventListener('click',     previewContent._spacerClickHandler);
  previewContent.addEventListener('mouseover', previewContent._spacerMoveHandler);
  previewContent.addEventListener('mouseleave', previewContent._spacerLeaveHandler);

  insertBtn.addEventListener('mouseenter', () => clearTimeout(_spacerHover.hideTimer));
  insertBtn.addEventListener('mouseleave', hideBtn);
  insertBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // _spacerHover.target 대신 버튼에 저장된 참조 사용 (타이머 경쟁 방지)
    const target = insertBtn._spacerTarget;
    if (!target || !document.contains(target)) return;
    showSpacerInsertPicker(target, insertBtn);
  });
}

function showSpacerInsertPicker(targetEl, anchorEl) {
  document.getElementById('spacer-insert-picker')?.remove();

  const picker = document.createElement('div');
  picker.id = 'spacer-insert-picker';
  picker.className = 'spacer-insert-picker';

  const makeRow = (label, position) => {
    const row = document.createElement('div');
    row.className = 'spacer-picker-row';
    row.innerHTML = `<span class="spacer-picker-label">${label}</span>`;
    ['h10','h20','h30','h40'].forEach(h => {
      const btn = document.createElement('button');
      btn.textContent = h;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const spacer = document.createElement('div');
        spacer.className = h;
        spacer.dataset.spacerSetup = 'true';
        spacer.dataset.spacerLabel = h;
        spacer.addEventListener('click', handleSpacerClick);
        targetEl.insertAdjacentElement(position === 'before' ? 'beforebegin' : 'afterend', spacer);
        picker.remove();
        _spacerHover.btn?.classList.remove('visible');
        editHistory.push();
        saveInlineEdits();
      });
      row.appendChild(btn);
    });
    return row;
  };

  picker.appendChild(makeRow('위에 추가', 'before'));
  picker.appendChild(makeRow('아래 추가', 'after'));
  document.body.appendChild(picker);

  // 위치: 버튼 바로 아래
  const aRect = anchorEl.getBoundingClientRect();
  picker.style.top  = (aRect.bottom + 6) + 'px';
  picker.style.left = (aRect.left + aRect.width / 2) + 'px';
  picker.style.transform = 'translateX(-50%)';
  // 화면 밖 보정
  requestAnimationFrame(() => {
    const pRect = picker.getBoundingClientRect();
    if (pRect.right > window.innerWidth - 4) {
      picker.style.left = (window.innerWidth - pRect.width - 4) + 'px';
      picker.style.transform = 'none';
    }
    if (pRect.left < 4) {
      picker.style.left = '4px';
      picker.style.transform = 'none';
    }
  });

  const onOutside = (e) => {
    if (!picker.contains(e.target) && e.target !== anchorEl) {
      picker.remove();
      document.removeEventListener('click', onOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', onOutside), 0);
}

function showSaveNotification() {
  // 간단한 토스트 알림
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    z-index: 9999;
    animation: fadeInOut 2s ease-in-out;
  `;
  notification.textContent = '✓ 변경 사항이 저장되었습니다';

  // 애니메이션 스타일 추가
  if (!document.getElementById('save-notification-style')) {
    const style = document.createElement('style');
    style.id = 'save-notification-style';
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(10px); }
        15% { opacity: 1; transform: translateY(0); }
        85% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2000);
}

// ============================================
// 편집 히스토리 (Undo / Redo)
// ============================================

const editHistory = {
  past: [],    // 이전 스냅샷 스택
  future: [],  // 되돌리기 후 앞으로 가기 스택
  maxSize: 50,
  _isMajorOp: false,  // 삭제/테이블 조작 등 주요 동작 플래그

  /** 현재 preview-content HTML을 히스토리에 저장 */
  push() {
    const pc = document.getElementById('preview-content');
    if (!pc) return;
    const html = pc.innerHTML;
    if (this.past.length > 0 && this.past[this.past.length - 1] === html) return;
    this.past.push(html);
    if (this.past.length > this.maxSize) this.past.shift();
    this.future.length = 0;
  },

  /** 주요 동작(삭제, 테이블) 전에 스냅샷 저장 + 플래그 설정
   *  → saveInlineEdits()가 후속으로 push()를 건너뛰게 함 */
  pushMajor() {
    this.push();
    this._isMajorOp = true;
  },

  /** 되돌리기 */
  undo() {
    if (this.past.length === 0) return false;
    const pc = document.getElementById('preview-content');
    if (pc) this.future.push(pc.innerHTML);
    this._restore(this.past.pop());
    return true;
  },

  /** 다시 실행 */
  redo() {
    if (this.future.length === 0) return false;
    const pc = document.getElementById('preview-content');
    if (pc) this.past.push(pc.innerHTML);
    this._restore(this.future.pop());
    return true;
  },

  _restore(html) {
    const pc = document.getElementById('preview-content');
    if (!pc) return;
    pc.innerHTML = html;
    // 복원된 HTML에 남아있는 편집 속성 제거 → setupInlineEditors가 이벤트 리스너를 재등록할 수 있도록
    pc.querySelectorAll('[data-editable-setup]').forEach(el => {
      el.removeAttribute('data-editable-setup');
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-original-content');
    });
    if (state.editMode) setupInlineEditors();
    // state.convertedHtml 동기화 (templ_content 내부 기준)
    const tc = pc.querySelector('.templ_content');
    if (tc) {
      const clone = tc.cloneNode(true);
      cleanEditingAttrs(clone);
      state.convertedHtml = clone.innerHTML;
    } else {
      state.convertedHtml = html;
    }
    updateHtmlCode();
    this._isMajorOp = false;
  },
};

// ============================================
// 플로팅 툴바 (WYSIWYG)
// ============================================

const floatingToolbar = {
  element: null,
  isVisible: false,
  currentSelection: null,
  currentEditableEl: null,
  _suppressBlur: false,

  // 불릿 스타일 목록 (ul/ol 클래스 → 표시 기호)
  BULLET_TYPES: [
    { tag: 'ul', cls: 'ulist',       sym: '·',  label: '중간점' },
    { tag: 'ul', cls: 'ulist dash',  sym: '-',  label: '대시' },
    { tag: 'ul', cls: 'ulist noti',  sym: '※', label: '주의' },
    { tag: 'ul', cls: 'ulist star',  sym: '*',  label: '별표' },
    { tag: 'ul', cls: 'ulist check', sym: '✓', label: '체크' },
    { tag: 'ul', cls: 'ulist stri',  sym: '▸', label: '삼각형' },
    { tag: 'ul', cls: 'ulist rarro', sym: '→', label: '화살표' },
    { tag: 'ul', cls: 'ulist finger',sym: '☞', label: '손가락' },
    { tag: 'ul', cls: 'ulist cir',   sym: '○', label: '흰원' },
    { tag: 'ul', cls: 'ulist bcir',  sym: '●', label: '검은원' },
    { tag: 'ul', cls: 'ulist scir',  sym: '◦', label: '작은흰원' },
    { tag: 'ul', cls: 'ulist bull',  sym: '•',  label: '불릿' },
    { tag: 'ul', cls: 'ulist dbcir', sym: '◉', label: '채운이중원' },
    { tag: 'ul', cls: 'ulist ecir',  sym: '◎', label: '불스아이' },
    { tag: 'ul', cls: 'ulist wcc',   sym: '❍', label: '그림자원' },
    { tag: 'ul', cls: 'ulist sq',    sym: '□', label: '흰사각' },
    { tag: 'ul', cls: 'ulist bsq',   sym: '■', label: '검은사각' },
    { tag: 'ul', cls: 'ulist ssq',   sym: '▪', label: '작은사각' },
    { tag: 'ul', cls: 'ulist wsq',   sym: '❏', label: '그림자사각' },
    { tag: 'ul', cls: 'ulist dbsq',  sym: '▣', label: '이중사각' },
    { tag: 'ul', cls: 'ulist dia',   sym: '◇', label: '흰다이아' },
    { tag: 'ul', cls: 'ulist bkdia', sym: '◆', label: '검은다이아' },
    { tag: 'ul', cls: 'ulist dbdia', sym: '◈', label: '이중다이아' },
    { tag: 'ol', cls: 'olist olnum',    sym: '1.',  label: '숫자' },
    { tag: 'ol', cls: 'olist olhbrac',  sym: '1)',  label: '숫자)' },
    { tag: 'ol', cls: 'olist olbracket',sym: '(1)', label: '(숫자)' },
    { tag: 'ol', cls: 'olist olcir',    sym: '①',  label: '원숫자' },
    { tag: 'ol', cls: 'olist kolist',   sym: '가.', label: '가나다.' },
    { tag: 'ol', cls: 'olist kohbrac',  sym: '가)', label: '가나다)' },
    { tag: 'ol', cls: 'olist kofbrac',  sym: '(가)',label: '(가나다)' },
    { tag: 'ol', cls: 'olist kofcir',   sym: '㉮',  label: '원한글' },
    { tag: 'ol', cls: 'olist kocir',    sym: '㉠',  label: '원자음' },
    { tag: 'ol', cls: 'olist encir',    sym: 'ⓐ',  label: '원알파벳' },
  ],

  init() {
    this.element = document.getElementById('floating-toolbar');
    if (!this.element) return;

    // 불릿 스타일 패널 초기화
    this._initBulletPanel();

    // 툴바 버튼 클릭 이벤트
    this.element.querySelectorAll('button[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // 포커스 유지
        const cmd = btn.dataset.cmd;
        this.executeCommand(cmd);
      });
    });

    // 불릿 패널 외부 클릭 시 닫기
    document.addEventListener('mousedown', (e) => {
      const panel = document.getElementById('bullet-style-panel');
      const wrap  = document.getElementById('bullet-style-wrap');
      if (!panel || panel.classList.contains('hidden')) return;
      // 패널 자체 또는 wrap 버튼 내부 클릭이면 닫지 않음
      if (wrap?.contains(e.target)) return;
      this._closeBulletPanel();
    });

    // 선택 변경 감지
    document.addEventListener('selectionchange', () => {
      if (!state.editMode) return;
      this.handleSelectionChange();
    });

    // 글자 크기 셀렉트
    const fontSizeSelect = document.getElementById('ft-fontsize');
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('mousedown', e => e.stopPropagation());
      fontSizeSelect.addEventListener('change', (e) => {
        const size = e.target.value;
        if (!size) return;
        this._restoreSelection();
        this.handleFontSize(size);
        e.target.value = '';
      });
    }

    // 글자 색상 컬러 피커
    const fontColorInput = document.getElementById('ft-fontcolor');
    if (fontColorInput) {
      fontColorInput.addEventListener('pointerdown', (e) => {
        // ★ pointerdown: mousedown보다 먼저 발생 (blur 전에 selection 저장)
        e.preventDefault();  // ★ 선택 손실 & focus 이동 방지
        e.stopPropagation();

        // blur로 contenteditable이 제거되지 않도록 억제
        this._suppressBlur = true;
        setTimeout(() => { this._suppressBlur = false; }, 1000);

        // ★ 현재 selection 저장 (blur 전에!)
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          this.currentSelection = sel.getRangeAt(0).cloneRange();
          const container = sel.getRangeAt(0).commonAncestorContainer;
          const node = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
          this.currentEditableEl = node?.closest('[contenteditable]') || null;
        } else {
          // ★ 선택이 없으면 마지막 contenteditable 찾아서 선택
          const previewContent = document.getElementById('preview-content');
          if (previewContent) {
            const editables = Array.from(previewContent.querySelectorAll('[contenteditable]'));
            if (editables.length > 0) {
              const lastEditable = editables[editables.length - 1];
              const range = document.createRange();
              range.selectNodeContents(lastEditable);
              this.currentSelection = range.cloneRange();
              this.currentEditableEl = lastEditable;
            }
          }
        }

        // ★ 수동으로 color picker 열기
        e.target.click();
      });
      fontColorInput.addEventListener('input', (e) => {
        // ★ input: 바 색상 + 스타일 즉시 적용 (실시간)
        const bar = document.getElementById('ft-fontcolor-bar');
        if (bar) bar.style.background = e.target.value;
        // ★ 항상 선택 복원 후 색상 적용
        this._restoreSelection();
        this.handleFontColor(e.target.value);
      });
      fontColorInput.addEventListener('change', (e) => {
        // ★ change: color picker 닫힘 - 명시적으로 blur 차단 해제 + 색상 재적용
        this._suppressBlur = false;  // ★ blur 차단 명시적 해제
        this._restoreSelection();
        this.handleFontColor(e.target.value);
      });
    }

    // 블릿 색상 컬러 피커 (선택 li에 color 스타일 적용)
    const bulletColorInput = document.getElementById('ft-bulletcolor');
    if (bulletColorInput) {
      bulletColorInput.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._suppressBlur = true;
        setTimeout(() => { this._suppressBlur = false; }, 1000);
        e.target.click();
      });
      bulletColorInput.addEventListener('input', (e) => {
        const bar = document.getElementById('ft-bulletcolor-bar');
        if (bar) bar.style.background = e.target.value;
        this._restoreSelection();
        this.handleBulletColor(e.target.value);
      });
      bulletColorInput.addEventListener('change', (e) => {
        this._suppressBlur = false;
        this._restoreSelection();
        this.handleBulletColor(e.target.value);
      });
    }

    // 텍스트 배경색 컬러 피커
    const textBgColorInput = document.getElementById('ft-textbgcolor');
    if (textBgColorInput) {
      textBgColorInput.addEventListener('pointerdown', (e) => {
        // ★ pointerdown: mousedown보다 먼저 발생 (blur 전에 selection 저장)
        e.preventDefault();  // ★ 선택 손실 & focus 이동 방지
        e.stopPropagation();

        // blur로 contenteditable이 제거되지 않도록 억제
        this._suppressBlur = true;
        setTimeout(() => { this._suppressBlur = false; }, 1000);

        // ★ 현재 selection 저장 (blur 전에!)
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          this.currentSelection = sel.getRangeAt(0).cloneRange();
          const container = sel.getRangeAt(0).commonAncestorContainer;
          const node = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
          this.currentEditableEl = node?.closest('[contenteditable]') || null;
        } else {
          // ★ 선택이 없으면 마지막 contenteditable 찾아서 선택
          const previewContent = document.getElementById('preview-content');
          if (previewContent) {
            const editables = Array.from(previewContent.querySelectorAll('[contenteditable]'));
            if (editables.length > 0) {
              const lastEditable = editables[editables.length - 1];
              const range = document.createRange();
              range.selectNodeContents(lastEditable);
              this.currentSelection = range.cloneRange();
              this.currentEditableEl = lastEditable;
            }
          }
        }

        // ★ 수동으로 color picker 열기
        e.target.click();
      });
      textBgColorInput.addEventListener('input', (e) => {
        const bar = document.getElementById('ft-textbgcolor-bar');
        if (bar) bar.style.background = e.target.value;
        // ★ input: 바 색상 + 스타일 즉시 적용 (실시간)
        // ★ 항상 선택 복원 후 배경색 적용
        this._restoreSelection();
        this.handleTextBgColor(e.target.value);
      });
      textBgColorInput.addEventListener('change', (e) => {
        // ★ change: color picker 닫힘 - 명시적으로 blur 차단 해제 + 배경색 재적용
        this._suppressBlur = false;  // ★ blur 차단 명시적 해제
        this._restoreSelection();
        this.handleTextBgColor(e.target.value);
      });
    }

    // ★ 최근 색상 초기화
    this._updateRecentColors('fontcolor');
    this._updateRecentColors('textbgcolor');

    // sticky 바 모드: mousedown으로 숨기지 않음 (편집 모드에서 항상 표시)
  },

  handleSelectionChange() {
    if (!state.editMode) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const previewContent = document.getElementById('preview-content');
      if (previewContent && previewContent.contains(range.commonAncestorContainer)) {
        // cloneRange()로 스냅샷 저장 — Selection은 라이브 참조라 나중에 collapsed될 수 있음
        this.currentSelection = range.cloneRange();
        // contenteditable 요소 참조도 저장 — 툴바 클릭 시 blur로 제거되어도 복원 가능
        const container = range.commonAncestorContainer;
        const node = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
        this.currentEditableEl = node?.closest('[contenteditable]') || null;
      }
    }
    this.updateActiveStates();
  },

  show() {
    if (!this.element) return;
    this.element.classList.remove('hidden');
    this.isVisible = true;
  },

  /** 저장된 선택 영역 복원 (currentSelection은 cloneRange() 스냅샷) */
  _restoreSelection() {
    if (!this.currentSelection) return;
    let editable = this.currentEditableEl;
    if (editable && !editable.getAttribute('contenteditable')) {
      editable.setAttribute('contenteditable', 'true');
      if (!editable.dataset.originalContent) {
        editable.dataset.originalContent = editable.innerHTML;
      }
    } else if (!editable) {
      const container = this.currentSelection.commonAncestorContainer;
      const node = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
      editable = node?.closest('[contenteditable]');
      // fallback: previewContent 안 첫 번째 contenteditable (다중 요소 선택 시)
      if (!editable) {
        const pc = document.getElementById('preview-content');
        editable = pc?.querySelector('[contenteditable]') || null;
      }
    }
    if (editable) editable.focus({ preventScroll: true });
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(this.currentSelection);
    } catch (e) {}
  },

  /** 프리셋 색상 (항상 툴바에 노출) */
  FONT_PRESET_COLORS: ['#121212', '#0a7dff', '#ff0000', '#ffb40a', '#007506', '#ff460a'],
  BG_PRESET_COLORS: ['#ffeaea', '#eaf5ff', '#fffeea', '#fff977', '#edffee', '#ffe6de'],

  /** ★ 최근 색상 저장 (1개만 유지) */
  _addRecentColor(type, color) {
    const key = `recent_${type}_colors`;
    // 최근 색상은 항상 마지막 1개만 유지
    localStorage.setItem(key, JSON.stringify([color]));
    this._updateRecentColors(type);
  },

  /** ★ 프리셋 + 최근 색상 UI 업데이트 */
  _updateRecentColors(type) {
    const containerId = `ft-${type}-recent`;
    const container = document.getElementById(containerId);
    if (!container) return;

    const key = `recent_${type}_colors`;
    // 과거 버전에서 저장된 여러 색상 배열이 있어도 첫 1개만 사용
    const recentColors = (JSON.parse(localStorage.getItem(key)) || []).slice(0, 1);
    const presets = type === 'fontcolor' ? this.FONT_PRESET_COLORS : this.BG_PRESET_COLORS;

    // 프리셋 + 구분선 + 최근 1개
    const presetHtml = presets.map(color => `
      <button class="toolbar-recent-color preset"
              data-color="${color}"
              style="background-color: ${color};"
              title="${color}"></button>
    `).join('');

    const recentHtml = recentColors.length > 0 ? `
      <span class="toolbar-recent-sep" style="display:inline-block;width:1px;height:14px;background:#4b5563;margin:0 3px;vertical-align:middle;"></span>
      ${recentColors.map(color => `
        <button class="toolbar-recent-color"
                data-color="${color}"
                style="background-color: ${color};"
                title="최근: ${color}"></button>
      `).join('')}
    ` : '';

    container.innerHTML = presetHtml + recentHtml;

    // 프리셋/최근 색상 버튼 클릭 이벤트
    container.querySelectorAll('.toolbar-recent-color').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        // 선택 유지 — pointerdown과 동일 패턴
        e.preventDefault();
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const color = btn.dataset.color;

        if (type === 'fontcolor') {
          const bar = document.getElementById('ft-fontcolor-bar');
          if (bar) bar.style.background = color;
          document.getElementById('ft-fontcolor').value = color;

          this._restoreSelection();
          this.handleFontColor(color);
        } else if (type === 'textbgcolor') {
          const bar = document.getElementById('ft-textbgcolor-bar');
          if (bar) bar.style.background = color;
          document.getElementById('ft-textbgcolor').value = color;

          this._restoreSelection();
          this.handleTextBgColor(color);
        }
      });
    });
  },

  /** 선택 텍스트에 글자 크기 적용 */
  handleFontSize(sizePx) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    // cross-element 지원: span 직접 삽입
    // ★ applySpanFormat 내부에서 선택 복원 처리
    if (applySpanFormat('fontSize', sizePx + 'px')) return;

    // fallback: execCommand (단일 요소 내 선택)
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    const previewContent = document.getElementById('preview-content');
    if (previewContent) {
      previewContent.querySelectorAll('font[size="7"]').forEach(font => {
        const span = document.createElement('span');
        span.style.fontSize = sizePx + 'px';
        span.innerHTML = font.innerHTML;
        font.parentNode.replaceChild(span, font);
      });
    }
    saveInlineEdits();
    updateHtmlCode();
  },

  /** 선택 텍스트에 글자 색상 적용 */
  handleFontColor(color) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    // ★ 최근 색상에 추가
    this._addRecentColor('fontcolor', color);

    // cross-element 지원: span 직접 삽입
    // ★ applySpanFormat 내부에서 선택 복원 처리
    if (applySpanFormat('color', color)) return;

    document.execCommand('styleWithCSS', false, true);
    document.execCommand('foreColor', false, color);
    document.execCommand('styleWithCSS', false, false);
    saveInlineEdits();
    updateHtmlCode();
  },

  handleTextBgColor(color) {
    const sel = window.getSelection();

    if (sel && !sel.isCollapsed) {
      // ★ 최근 색상에 추가
      this._addRecentColor('textbgcolor', color);

      // cross-element 지원: span 직접 삽입
      // ★ applySpanFormat 내부에서 선택 복원 처리
      if (applySpanFormat('backgroundColor', color)) return;

      document.execCommand('styleWithCSS', false, true);
      document.execCommand('hiliteColor', false, color);
      document.execCommand('styleWithCSS', false, false);

      saveInlineEdits();
      updateHtmlCode();
    } else if (tableToolbar.selectedCells.size > 0) {
      // ★ 최근 색상에 추가
      this._addRecentColor('textbgcolor', color);

      // 셀 선택 → 셀 배경색
      tableToolbar.selectedCells.forEach(cell => { cell.style.backgroundColor = color; });
    } else {
      return;
    }
  },

  hide() {
    if (!this.element) return;
    this.element.classList.add('hidden');
    this.isVisible = false;
    this.currentSelection = null;
    this.currentEditableEl = null;
  },

  /** 선택 텍스트를 인크루트 템플릿 버튼으로 변환 (모달 UI) */
  handleMakeButton() {
    const sel = window.getSelection();
    const selectedText = (sel && !sel.isCollapsed) ? sel.toString().trim() : '';

    const modal = document.getElementById('make-button-modal');
    if (!modal) return;

    const textInput    = document.getElementById('mbtn-text');
    const urlInput     = document.getElementById('mbtn-url');
    const bgColorInput = document.getElementById('mbtn-bgcolor');
    const bgHexInput   = document.getElementById('mbtn-bgcolor-hex');
    const txtColorInput= document.getElementById('mbtn-textcolor');
    const txtHexInput  = document.getElementById('mbtn-textcolor-hex');
    const previewSpan  = document.getElementById('mbtn-preview-span');

    // 초기값
    if (textInput)     textInput.value     = selectedText;
    if (urlInput)      urlInput.value      = '';
    if (bgColorInput)  bgColorInput.value  = '#FF460A';
    if (bgHexInput)    bgHexInput.value    = '#FF460A';
    if (txtColorInput) txtColorInput.value = '#FFFFFF';
    if (txtHexInput)   txtHexInput.value   = '#FFFFFF';

    // 미리보기 업데이트
    const updatePreview = () => {
      if (!previewSpan) return;
      previewSpan.style.background = bgColorInput?.value || '#FF460A';
      previewSpan.style.color      = txtColorInput?.value || '#FFFFFF';
      previewSpan.textContent      = textInput?.value.trim() || '버튼';
    };
    updatePreview();

    modal.classList.remove('hidden');
    textInput?.focus();

    const ac = new AbortController();
    const { signal } = ac;
    const close = () => { modal.classList.add('hidden'); ac.abort(); };

    // 색상 피커 ↔ hex 입력 양방향 동기화
    bgColorInput?.addEventListener('input',  () => { if (bgHexInput)  bgHexInput.value  = bgColorInput.value;  updatePreview(); }, { signal });
    bgHexInput?.addEventListener('input',   () => { if (/^#[0-9a-f]{6}$/i.test(bgHexInput.value) && bgColorInput) { bgColorInput.value = bgHexInput.value; } updatePreview(); }, { signal });
    txtColorInput?.addEventListener('input', () => { if (txtHexInput) txtHexInput.value = txtColorInput.value; updatePreview(); }, { signal });
    txtHexInput?.addEventListener('input',  () => { if (/^#[0-9a-f]{6}$/i.test(txtHexInput.value) && txtColorInput) { txtColorInput.value = txtHexInput.value; } updatePreview(); }, { signal });
    textInput?.addEventListener('input',    updatePreview, { signal });

    document.getElementById('mbtn-close')?.addEventListener('click', close, { signal });
    document.getElementById('mbtn-cancel')?.addEventListener('click', close, { signal });
    modal.addEventListener('click', e => { if (e.target === modal) close(); }, { signal });

    document.getElementById('mbtn-confirm')?.addEventListener('click', () => {
      const text     = textInput?.value.trim() || '버튼';
      const url      = urlInput?.value.trim() || '';
      const bgColor  = bgColorInput?.value || '#FF460A';
      const txtColor = txtColorInput?.value || '#FFFFFF';
      close();
      this._insertButton(text, url, bgColor, txtColor);
    }, { signal });
  },

  /**
   * 인크루트 템플릿 형식으로 버튼 삽입
   * 결과: <a href="" target="_blank"><span class="temp_btn btn btn_sm radius5" style="background:COLOR;color:COLOR;">텍스트</span></a>
   */
  _insertButton(text, url, bgColor, txtColor) {
    this._restoreSelection();

    const hrefAttr  = url ? ` href="${escapeHtml(url)}"` : ' href=""';
    const spanStyle = `background:${bgColor};color:${txtColor};`;
    const btnHtml   = `<a${hrefAttr} target="_blank"><span class="temp_btn btn btn_sm radius5" style="${spanStyle}">${escapeHtml(text)}</span></a>`;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const frag = range.createContextualFragment(btnHtml);
      const lastNode = frag.lastChild;
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      document.execCommand('insertHTML', false, btnHtml);
    }

    this.afterCommand();
  },

  updateActiveStates() {
    if (!this.element) return;

    // 불릿 스타일 버튼 — 커서가 ul/ol 안에 있을 때만 표시
    const bulletWrap = document.getElementById('bullet-style-wrap');
    if (bulletWrap) {
      const panel = document.getElementById('bullet-style-panel');
      const panelOpen = panel && !panel.classList.contains('hidden');

      // 패널이 열려 있는 동안은 bulletWrap을 숨기거나 패널을 닫지 않음
      // (selectionchange 등 외부 이벤트로 인한 오닫힘 방지)
      if (!panelOpen) {
        const sel = window.getSelection();
        // rangeCount > 0이면 커서만 있어도(collapsed) anchorNode 사용
        // rangeCount === 0이면 드롭다운 등으로 포커스가 이동한 경우 → 스냅샷 사용
        let node = (sel?.rangeCount > 0)
          ? sel.anchorNode
          : this.currentSelection?.commonAncestorContainer ?? null;
        if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
        // detached node인 경우 currentEditableEl로 fallback
        if (node && !document.contains(node)) node = this.currentEditableEl;
        const inList = !!node?.closest('ul, ol');
        bulletWrap.style.display = inList ? '' : 'none';
      }
    }

    // 현재 서식 상태 확인
    this.element.querySelectorAll('button[data-cmd]').forEach(btn => {
      const cmd = btn.dataset.cmd;
      let isActive = false;

      try {
        if (['bold', 'italic', 'underline', 'strikeThrough'].includes(cmd)) {
          isActive = document.queryCommandState(cmd);
        }
        // 정렬 상태: 현재 블록의 textAlign과 비교
        if (['justifyLeft', 'justifyCenter', 'justifyRight'].includes(cmd)) {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode;
            if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            const block = node?.closest('p, h1, h2, h3, h4, h5, h6, li, div, td, th');
            if (block) {
              const align = block.style.textAlign || 'left';
              const alignMap = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right' };
              isActive = align === alignMap[cmd];
            }
          }
        }
        // hanging indent 활성 상태
        if (cmd === 'hangingIndent') {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode;
            if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            const block = node?.closest('p, h1, h2, h3, h4, h5, h6, li');
            if (block) {
              const pl = parseFloat(block.style.paddingLeft) || 0;
              const ti = parseFloat(block.style.textIndent) || 0;
              isActive = pl > 0 && ti < 0;
            }
          }
        }
        // 블릿 볼드 활성 상태
        if (cmd === 'bulletBold') {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode;
            if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            const li = node?.closest('li');
            if (li) isActive = li.classList.contains('boldt');
          }
        }
        // 테두리 활성 상태
        if (cmd === 'border') {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            const target = findBorderTarget(sel.getRangeAt(0));
            if (target) isActive = !!target.style.border;
          }
        }
      } catch (e) {}

      btn.classList.toggle('active', isActive);
    });

    // olNumDecrease: 선택 <li> 앞에 <i>가 없으면 비활성화
    const decBtn = this.element.querySelector('[data-cmd="olNumDecrease"]');
    if (decBtn) {
      let prev = null;
      try {
        const sel = window.getSelection();
        const r = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : this.currentSelection;
        if (r) {
          let node = r.startContainer;
          if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
          const li = node?.closest?.('li');
          if (li && li.parentElement?.tagName === 'OL') {
            prev = li.previousElementSibling;
          }
        }
      } catch (_) {}
      const disabled = !(prev && prev.tagName === 'I');
      decBtn.classList.toggle('tbl-btn-disabled', disabled);
      decBtn.disabled = disabled;
    }
  },

  executeCommand(cmd) {
    // 선택 복원 (currentSelection은 cloneRange() 스냅샷 Range 객체)
    // bulletStyleToggle은 live selection만 사용하므로 복원 불필요
    // (복원하면 currentSelection이 리스트 밖 요소를 가리킬 때 커서가 이동 → inList=false → 패널 닫힘)
    // 들여쓰기 / 내어쓰기: _restoreSelection() 건너뜀
    // _restoreSelection()은 li에 contenteditable을 재부착하고 selection을 복원하는데,
    // 이 때 브라우저 편집 엔진이 li 안의 <br>를 새 <li>로 정규화하는 버그가 발생함
    // 대신 저장된 currentSelection range를 handleIndent에 직접 전달
    if (cmd === 'indent' || cmd === 'outdent') {
      this.handleIndent(cmd, this.currentSelection);
      return;
    }

    if (cmd !== 'bulletStyleToggle' && this.currentSelection) {
      const container = this.currentSelection.commonAncestorContainer;
      if (container && document.contains(container)) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.currentSelection);
      } else {
        // detached → stale range 폐기
        this.currentSelection = null;
        this.currentEditableEl = null;
      }
    }

    if (cmd === 'hangingIndent') {
      this.handleHangingIndent();
      return;
    }

    if (cmd === 'bulletBold') {
      this.handleBulletBold();
      return;
    }

    if (cmd === 'bulletColorClear') {
      this.handleBulletColor(null);  // null → color 제거
      return;
    }

    if (cmd === 'olNumIncrease') {
      this.handleOlNumChange('increase');
      return;
    }

    if (cmd === 'olNumDecrease') {
      this.handleOlNumChange('decrease');
      return;
    }

    if (cmd === 'spacerInsert') {
      this.handleSpacerInsert();
      return;
    }

    if (cmd === 'border') {
      const borderBtn = this.element.querySelector('[data-cmd="border"]');
      if (_multiSelect.active) {
        exitMultiSelectMode();
      } else {
        enterMultiSelectMode(borderBtn);
      }
      return;
    }

    // 텍스트 정렬
    if (['justifyLeft', 'justifyCenter', 'justifyRight'].includes(cmd)) {
      this.handleAlign(cmd);
      return;
    }

    // 제목 변환 (H1, H2, H3, P)
    if (['h1', 'h2', 'h3', 'p'].includes(cmd)) {
      this.changeBlockTag(cmd);
      return;
    }

    // 불릿 스타일 드롭다운 토글
    if (cmd === 'bulletStyleToggle') {
      const panel = document.getElementById('bullet-style-panel');
      if (!panel) return;
      const isHidden = panel.classList.contains('hidden');
      panel.classList.toggle('hidden', !isHidden);
      if (!isHidden) return;
      // 현재 리스트의 현재 클래스 표시
      const sel = window.getSelection();
      let node = sel?.anchorNode;
      if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const listEl = node?.closest('ul, ol');
      if (listEl) {
        const currentCls = Array.from(listEl.classList).join(' ');
        panel.querySelectorAll('.bsp-item').forEach(item => {
          item.classList.toggle('active', currentCls.includes(item.dataset.bulletCls));
        });
      }
      return;
    }

    // 섹션 삭제
    if (cmd === 'deleteSection') {
      this.handleDeleteSection();
      return;
    }

    // 링크 삽입
    if (cmd === 'createLink') {
      const url = prompt('링크 URL을 입력하세요:', 'https://');
      if (url && url !== 'https://') {
        document.execCommand('createLink', false, url);
      }
      this.afterCommand();
      return;
    }

    // 버튼 만들기
    if (cmd === 'makeButton') {
      this.handleMakeButton();
      return;
    }

    // ★ Star 리스트를 P 태그로 변환
    if (cmd === 'convertStarListToP') {
      this.handleConvertStarListToP();
      return;
    }

    // ★ bold, italic, underline: applySpanFormat 사용 (여러 줄 지원)
    if (cmd === 'bold') {
      this._restoreSelection();
      toggleBoldFormat();
      this.afterCommand();
      return;
    }

    if (cmd === 'italic') {
      this._restoreSelection();
      applySpanFormat('fontStyle', 'italic');
      this.afterCommand();
      return;
    }

    if (cmd === 'underline') {
      this._restoreSelection();
      toggleUnderlineFormat();
      this.afterCommand();
      return;
    }

    // ★ 취소선: applySpanFormat 사용 (여러 줄 지원)
    if (cmd === 'strikeThrough') {
      this._restoreSelection();
      applySpanFormat('textDecoration', 'line-through');
      this.afterCommand();
      return;
    }

    // ★ 위첨자: applySpanFormat 사용 (여러 줄 지원)
    if (cmd === 'superscript') {
      this._restoreSelection();
      applySpanFormat('verticalAlign', 'super');
      this.afterCommand();
      return;
    }

    // ★ 아랫첨자: applySpanFormat 사용 (여러 줄 지원)
    if (cmd === 'subscript') {
      this._restoreSelection();
      applySpanFormat('verticalAlign', 'sub');
      this.afterCommand();
      return;
    }

    // 일반 execCommand
    try {
      document.execCommand(cmd, false, null);
    } catch (e) {
      console.warn('execCommand failed:', cmd, e);
    }

    this.afterCommand();
  },

  /** ★ class="star"인 <ul>을 <p> 태그로 변환 */
  handleConvertStarListToP() {
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;

    const starLists = previewContent.querySelectorAll('ul.star');
    if (starLists.length === 0) {
      alert('변환할 Star 리스트가 없습니다.');
      return;
    }

    starLists.forEach(ul => {
      const fragment = document.createDocumentFragment();
      const liElements = Array.from(ul.querySelectorAll('li'));

      // ★ Step 1: 최대 별 개수 감지
      let maxStarCount = 0;
      liElements.forEach(li => {
        const text = li.innerHTML.trim();
        const starMatch = text.match(/^(\*+)\s/);
        const starCount = starMatch ? starMatch[1].length : 0;
        if (starCount > maxStarCount) {
          maxStarCount = starCount;
        }
      });

      // ★ Step 2: 별 개수별 고정 em값 매핑
      const emValueMap = {
        1: '1.1em',
        2: '1.2em',
        3: '1.6em',
        4: '2em',
        5: '2.7em'
      };

      // ★ Step 3: 모든 li를 p로 변환 (별 개수별 고정 em값 적용)
      liElements.forEach(li => {
        const text = li.innerHTML.trim();

        // 별 개수 감지
        const starMatch = text.match(/^(\*+)\s/);
        const starCount = starMatch ? starMatch[1].length : 0;

        // ★ 공백 개수 = (최대별 - 현재별) * 2 (역방향)
        // 예: 최대 5개일 때, 5개는 0, 4개는 2, 3개는 4, 2개는 6, 1개는 8
        const spaceCount = (maxStarCount - starCount) * 2;
        const spaces = '&nbsp;'.repeat(spaceCount);

        const p = document.createElement('p');
        p.classList.add('star-list-indent'); // HTML 내보내기 시 스타일 보존용

        // ★ 별 개수별 고정 em값 적용
        const emValue = emValueMap[starCount] || emValueMap[1];
        p.style.paddingLeft = emValue;
        p.style.textIndent = '-' + emValue;

        // 내용: 공백 + 원본 텍스트
        p.innerHTML = spaces + text;
        fragment.appendChild(p);
      });

      // <ul> 모두 교체
      ul.parentNode.replaceChild(fragment, ul);
    });

    saveInlineEdits();
    updateHtmlCode();
    this.afterCommand();
  },

  changeBlockTag(tagName) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    let block = range.startContainer;

    // 텍스트 노드면 부모로 이동
    if (block.nodeType === Node.TEXT_NODE) {
      block = block.parentElement;
    }

    // 가장 가까운 블록 요소 찾기
    const blockTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'LI'];
    while (block && !blockTags.includes(block.tagName)) {
      block = block.parentElement;
    }

    if (!block) return;

    // [특수 케이스] <li>를 p/h1/h2/h3로 변환 → list 바깥으로 추출 + 필요 시 list 분할
    const isLiInList = block.tagName === 'LI'
      && block.parentElement
      && ['UL', 'OL'].includes(block.parentElement.tagName);
    if (isLiInList && ['p', 'h1', 'h2', 'h3'].includes(tagName)) {
      const li = block;
      const list = li.parentElement;
      const listParent = list.parentNode;
      const listTag = list.tagName.toLowerCase();
      const listCls = list.className;

      // 새 블록 요소 생성
      const newBlock = document.createElement(tagName);
      newBlock.innerHTML = li.innerHTML;
      if (li.className) newBlock.className = li.className;
      if (state.editMode) newBlock.setAttribute('contenteditable', 'true');

      // li의 형제들 — 앞/뒤로 분리
      const siblings = Array.from(list.children);
      const idx = siblings.indexOf(li);
      const before = siblings.slice(0, idx);
      const after = siblings.slice(idx + 1);

      // Fragment에 조립
      const frag = document.createDocumentFragment();
      if (before.length > 0) {
        const beforeList = document.createElement(listTag);
        beforeList.className = listCls;
        before.forEach(item => beforeList.appendChild(item));
        frag.appendChild(beforeList);
      }
      frag.appendChild(newBlock);
      if (after.length > 0) {
        const afterList = document.createElement(listTag);
        afterList.className = listCls;
        after.forEach(item => afterList.appendChild(item));
        frag.appendChild(afterList);
      }

      listParent.replaceChild(frag, list);
      newBlock.focus();
      // 커서를 새 블록 시작 지점에 배치
      const sel = window.getSelection();
      const newRange = document.createRange();
      newRange.selectNodeContents(newBlock);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      this.afterCommand();
      return;
    }

    // 일반 케이스: 블록 태그 교체
    const newElement = document.createElement(tagName);
    newElement.innerHTML = block.innerHTML;
    if (block.className) newElement.className = block.className;

    block.parentNode.replaceChild(newElement, block);

    // 새 요소에 contenteditable 설정
    newElement.setAttribute('contenteditable', 'true');
    newElement.focus();

    this.afterCommand();
  },

  // 불릿 스타일 패널 DOM 생성
  _initBulletPanel() {
    const panel = document.getElementById('bullet-style-panel');
    if (!panel) return;

    // ul 그룹
    const ulGroup = document.createElement('div');
    ulGroup.className = 'bsp-group';
    ulGroup.innerHTML = '<div class="bsp-group-label">순서 없는 목록</div>';
    const ulGrid = document.createElement('div');
    ulGrid.className = 'bsp-grid';
    this.BULLET_TYPES.filter(b => b.tag === 'ul').forEach(b => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'bsp-item';
      item.dataset.bulletCls = b.cls;
      item.dataset.bulletTag = b.tag;
      item.title = b.label;
      item.innerHTML = `<span class="bsp-sym">${b.sym}</span><span class="bsp-label">${b.label}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.handleBulletStyleChange(b.tag, b.cls);
        this._closeBulletPanel();
      });
      ulGrid.appendChild(item);
    });
    ulGroup.appendChild(ulGrid);

    // ol 그룹
    const olGroup = document.createElement('div');
    olGroup.className = 'bsp-group';
    olGroup.innerHTML = '<div class="bsp-group-label">순서 있는 목록</div>';
    const olGrid = document.createElement('div');
    olGrid.className = 'bsp-grid';
    this.BULLET_TYPES.filter(b => b.tag === 'ol').forEach(b => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'bsp-item';
      item.dataset.bulletCls = b.cls;
      item.dataset.bulletTag = b.tag;
      item.title = b.label;
      item.innerHTML = `<span class="bsp-sym">${b.sym}</span><span class="bsp-label">${b.label}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.handleBulletStyleChange(b.tag, b.cls);
        this._closeBulletPanel();
      });
      olGrid.appendChild(item);
    });
    olGroup.appendChild(olGrid);

    panel.appendChild(ulGroup);
    panel.appendChild(olGroup);
  },

  _closeBulletPanel() {
    const panel = document.getElementById('bullet-style-panel');
    if (panel) panel.classList.add('hidden');
  },

  // 현재 선택된 ul/ol 요소의 클래스를 변경
  handleBulletStyleChange(newTag, newCls) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    // 가장 가까운 ul 또는 ol 요소 찾기
    const listEl = node?.closest('ul, ol');
    if (!listEl) return;

    const currentTag = listEl.tagName.toLowerCase();

    // BULLET_TYPES에서 모든 서브클래스 수집 (ulist/olist 제외)
    const allSubClasses = new Set(
      this.BULLET_TYPES.flatMap(b => b.cls.split(' ').filter(c => c !== 'ulist' && c !== 'olist'))
    );

    let finalList;
    if (currentTag === newTag) {
      // 같은 태그: 모든 불릿 관련 클래스 제거 후 새 클래스 적용
      listEl.classList.remove('ulist', 'olist');
      allSubClasses.forEach(c => listEl.classList.remove(c));
      newCls.split(' ').forEach(c => { if (c) listEl.classList.add(c); });
      finalList = listEl;
    } else {
      // 태그 변경 (ul ↔ ol)
      const newList = document.createElement(newTag);
      newCls.split(' ').forEach(c => { if (c) newList.classList.add(c); });
      // 기존 li 이전
      Array.from(listEl.children).forEach(li => newList.appendChild(li.cloneNode(true)));
      listEl.parentNode.replaceChild(newList, listEl);
      // contenteditable 이어받기 (기존 리스트가 편집 중이었으면 새 리스트도 활성화)
      if (listEl.getAttribute('contenteditable') === 'true') {
        newList.setAttribute('contenteditable', 'true');
        if (listEl.dataset.originalContent !== undefined) {
          newList.dataset.originalContent = listEl.dataset.originalContent;
        }
        newList.focus();
      }
      finalList = newList;
    }

    // 불릿 스타일을 명시적으로 변경했으므로 li의 has-marker / list-style:none 제거
    // fixDoubleMarkers가 자동 추가한 값이 새 CSS ::before 마커를 가리는 문제 방지
    finalList.querySelectorAll('li.has-marker').forEach(li => {
      li.classList.remove('has-marker');
      li.style.removeProperty('list-style');
    });

    // 패널에서 현재 선택 표시 업데이트
    document.querySelectorAll('#bullet-style-panel .bsp-item').forEach(item => {
      item.classList.toggle('active', item.dataset.bulletCls === newCls);
    });

    this.afterCommand();
  },

  afterCommand() {
    this.updateActiveStates();
    fixInvalidPWrap();
    // DOM 구조가 바뀐 경우 새 요소에 이벤트 리스너 등록 (insertUnorderedList 등으로 생성된 li 포함)
    if (state.editMode) setupInlineEditors();
    // 변경 사항 저장
    setTimeout(() => {
      saveInlineEdits();
    }, 10);
  },

  handleIndent(direction, savedRange) {
    // savedRange: executeCommand에서 직접 전달 (contenteditable 재부착 없이 사용)
    // 전달된 range가 없으면 live selection에서 가져옴
    const range = savedRange || (window.getSelection()?.rangeCount > 0
      ? window.getSelection().getRangeAt(0)
      : null);
    if (!range) return;

    const indentableTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI']);
    const blocks = this.getBlockElementsInRange(range)
      .filter(b => indentableTags.has(b.tagName));

    // 테이블 들여쓰기는 테이블 툴바의 전용 버튼(indentTable/outdentTable)에서 처리.
    // 여기서는 LI/P/H 블록만 처리 — 외곽 table이 range와 교차해도 영향 없음.

    // LI 교체 이후 stale 상태가 된 currentSelection을 새 블록으로 갱신하기 위한 추적
    let lastProcessedBlock = null;

    blocks.forEach(block => {
      if (block.tagName === 'LI') {
        // li에 contenteditable이 있는 상태에서 setAttribute('contenteditable', 'true')를
        // 다시 붙이는 순간 브라우저가 <br>→<li> 정규화를 실행함.
        // 해결: outerHTML 문자열로 직렬화 → 새 li 노드 생성(contenteditable 없음) → replaceChild
        // outerHTML은 <br>을 그대로 보존하고, 파싱 대상 div는 contenteditable이 아니므로 정규화 없음.
        // replaceChild 대상인 ul/ol도 contenteditable이 아니므로 안전.
        const parent = block.parentNode;
        if (!parent) return;

        const outerHtml = block.outerHTML;
        const tmp = document.createElement('div');
        tmp.innerHTML = outerHtml;
        const newLi = tmp.firstElementChild;

        // 편집 관련 속성 제거 (setupInlineEditors에서 재등록됨)
        newLi.removeAttribute('contenteditable');
        newLi.removeAttribute('data-original-content');
        newLi.removeAttribute('data-editable-setup');

        const current = parseInt(newLi.style.getPropertyValue('margin-left')) || 0;
        const newMargin = direction === 'indent' ? current + 18 : Math.max(0, current - 18);
        if (newMargin) {
          newLi.style.setProperty('margin-left', newMargin + 'px', 'important');
        } else {
          newLi.style.removeProperty('margin-left');
        }

        parent.replaceChild(newLi, block);
        lastProcessedBlock = newLi;
      } else {
        const wasEditable = block.getAttribute('contenteditable');
        if (wasEditable !== null) block.removeAttribute('contenteditable');

        const current = parseInt(block.style.getPropertyValue('margin-left')) || 0;
        const newMargin = direction === 'indent'
          ? current + 18
          : Math.max(0, current - 18);
        if (newMargin) {
          block.style.setProperty('margin-left', newMargin + 'px', 'important');
        } else {
          block.style.removeProperty('margin-left');
        }

        if (wasEditable !== null) block.setAttribute('contenteditable', wasEditable);
        lastProcessedBlock = block;
      }
    });

    // 저장된 currentSelection이 교체된 LI를 가리켜 detached 되는 문제 해결:
    // 마지막으로 처리한 블록을 가리키도록 갱신하여 연속 클릭이 정상 동작.
    if (lastProcessedBlock && document.contains(lastProcessedBlock)) {
      try {
        const newRange = document.createRange();
        newRange.selectNodeContents(lastProcessedBlock);
        newRange.collapse(false);
        this.currentSelection = newRange;
      } catch (_) {}
    }

    this.afterCommand();
  },

  handleHangingIndent() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const rawBlocks = this.getBlockElementsInRange(range)
      .filter(b => ['P', 'H1', 'H2', 'H3', 'H4', 'LI', 'TD', 'TH'].includes(b.tagName));

    // TD/TH는 splitBlockAtBr 대상 제외 (분리하면 테이블 구조 파괴)
    // → applyHangingIndentToCell로 즉시 처리 후 blocks에 추가하지 않음
    rawBlocks.forEach(block => {
      if (['TD', 'TH'].includes(block.tagName)) {
        applyHangingIndentToCell(block, range);
        return;
      }
    });

    // <br> 포함 블록은 줄 단위로 분리 후 선택 범위에 포함된 줄만 처리
    const blocks = [];
    rawBlocks.forEach(block => {
      if (['TD', 'TH'].includes(block.tagName)) return; // 위에서 처리 완료
      if (!block.querySelector('br')) {
        blocks.push(block);
        return;
      }
      splitBlockAtBr(block).forEach(nb => {
        if (range.intersectsNode(nb)) blocks.push(nb);
      });
    });

    // 첫 공백까지 텍스트 폭을 em 단위로 측정
    const measurePrefixEm = (block) => {
      const text = block.textContent;
      const idx = text.search(/\s/);
      const prefix = idx > 0 ? text.slice(0, idx + 1) : '';
      if (!prefix) return 1;
      const cs = getComputedStyle(block);
      const probe = document.createElement('span');
      probe.style.cssText = `visibility:hidden;position:absolute;white-space:pre;` +
        `font-size:${cs.fontSize};font-family:${cs.fontFamily};` +
        `font-weight:${cs.fontWeight};letter-spacing:${cs.letterSpacing};`;
      probe.textContent = prefix;
      document.body.appendChild(probe);
      const px = probe.getBoundingClientRect().width;
      document.body.removeChild(probe);
      const fs = parseFloat(cs.fontSize);
      return fs > 0 ? Math.round((px / fs) * 100) / 100 : 1;
    };

    blocks.forEach(block => {
      if (block.tagName === 'LI') {
        // LI: 불릿 위치 보존 — 내부 span.hanging-indent-wrap으로 감싸기
        const wrapper = block.querySelector(':scope > span.hanging-indent-wrap');
        if (wrapper) {
          while (wrapper.firstChild) block.insertBefore(wrapper.firstChild, wrapper);
          wrapper.remove();
        } else {
          const em = measurePrefixEm(block);
          const wrap = document.createElement('span');
          wrap.className = 'hanging-indent-wrap';
          wrap.style.cssText = `display:block;padding-left:${em}em;text-indent:${-em}em;`;
          while (block.firstChild) wrap.appendChild(block.firstChild);
          block.appendChild(wrap);
        }
        return;
      }

      // P, H1–H4 등: 직접 스타일 대신 내부 span으로 감싸기 (드래그 오류 방지)
      const existingWrap = block.querySelector(':scope > span.hanging-indent-wrap');
      if (existingWrap) {
        // 토글 해제
        while (existingWrap.firstChild) block.insertBefore(existingWrap.firstChild, existingWrap);
        existingWrap.remove();
        block.style.paddingLeft = '';
        block.style.textIndent  = '';
      } else {
        // 기존 직접 스타일도 제거
        block.style.paddingLeft = '';
        block.style.textIndent  = '';
        const em = measurePrefixEm(block);
        const wrap = document.createElement('span');
        wrap.className = 'hanging-indent-wrap';
        wrap.style.cssText = `display:block;padding-left:${em}em;text-indent:${-em}em;`;
        while (block.firstChild) wrap.appendChild(block.firstChild);
        block.appendChild(wrap);
      }
    });

    this.afterCommand();
  },

  /**
   * 선택 범위의 li 요소들에 color 스타일 적용 (블릿 기호·텍스트 동시 색상)
   * @param {string|null} color - CSS 색상 (#rrggbb 등) 또는 null(색상 제거)
   */
  handleBulletColor(color) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;

    const lis = [];
    if (range.collapsed) {
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const li = node?.closest('li');
      if (li && previewContent.contains(li)) lis.push(li);
    } else {
      previewContent.querySelectorAll('li').forEach(li => {
        if (range.intersectsNode(li)) lis.push(li);
      });
    }

    if (lis.length === 0) return;

    lis.forEach(li => {
      if (color) {
        li.style.color = color;
      } else {
        li.style.color = '';
        if (!li.getAttribute('style')) li.removeAttribute('style');
      }
    });

    this.afterCommand();
  },

  handleBulletBold() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // 선택 범위 내 모든 li 수집 (단일 커서면 가장 가까운 li 하나)
    const lis = [];
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return;

    if (range.collapsed) {
      // 커서만 있을 때 → 현재 li
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      const li = node?.closest('li');
      if (li && previewContent.contains(li)) lis.push(li);
    } else {
      // 범위 선택 → 교차하는 모든 li
      previewContent.querySelectorAll('li').forEach(li => {
        if (range.intersectsNode(li)) lis.push(li);
      });
    }

    if (lis.length === 0) return;

    // 선택된 li 중 하나라도 boldt가 없으면 → 전체 추가, 모두 있으면 → 전체 제거
    const allBoldt = lis.every(li => li.classList.contains('boldt'));
    lis.forEach(li => li.classList.toggle('boldt', !allBoldt));

    this.afterCommand();
  },

  /**
   * 여백(spacer) 삽입: 현재 커서가 위치한 블록을 기준으로 picker를 띄움.
   * hover "+ 여백 추가" 버튼의 대체 UX — 플로팅 툴바에서 접근하도록 함.
   * 정책(hover와 동일): 테이블 내부/previewContent 밖은 제외.
   */
  handleSpacerInsert() {
    const sel = window.getSelection();
    let range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : this.currentSelection;
    if (!range) return;
    let node = range.startContainer;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (!node) return;

    const previewContent = document.getElementById('preview-content');
    if (!previewContent || !previewContent.contains(node)) return;
    if (node.closest && node.closest('table')) return;

    const block = node.closest?.('h1, h2, h3, h4, p, ul, ol, .sec_wrap, .jp-sec, div.h10, div.h20, div.h30, div.h40');
    if (!block || !previewContent.contains(block) || block === previewContent) return;

    const anchorEl = this.element.querySelector('[data-cmd="spacerInsert"]');
    if (!anchorEl || typeof showSpacerInsertPicker !== 'function') return;
    showSpacerInsertPicker(block, anchorEl);
  },

  /**
   * ol 리스트 번호 증감: 선택 <li> 앞에 <i></i> 시블링을 추가/제거.
   * <i></i>를 리스트 카운터가 세어 li의 표시 번호가 +1씩 변함.
   * direction: 'increase' | 'decrease'
   * decrease는 바로 앞 시블링이 <i> 태그일 때만 동작 (없으면 no-op).
   */
  handleOlNumChange(direction) {
    // selection 복원은 executeCommand에서 이미 완료됨 (currentSelection → live sel)
    const sel = window.getSelection();
    let range = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0) : this.currentSelection;
    if (!range) return;

    let node = range.startContainer;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const li = node?.closest?.('li');
    if (!li) return;
    const ol = li.parentElement;
    if (!ol || ol.tagName !== 'OL') return;

    if (direction === 'increase') {
      const i = document.createElement('i');
      ol.insertBefore(i, li);
    } else {
      const prev = li.previousElementSibling;
      if (prev && prev.tagName === 'I') {
        prev.remove();
      }
    }

    this.afterCommand();
  },

  handleAlign(cmd) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const blocks = this.getBlockElementsInRange(range);
    const alignMap = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right' };
    const align = alignMap[cmd] || 'left';

    blocks.forEach(block => {
      block.style.textAlign = align === 'left' ? '' : align;
    });

    this.afterCommand();
  },

  getBlockElementsInRange(range) {
    const blocks = new Set();
    const blockSelector = 'p, h1, h2, h3, h4, h5, h6, li, div, td, th';
    const previewContent = document.getElementById('preview-content');
    if (!previewContent) return [];

    const container = range.commonAncestorContainer;

    // 단일 텍스트 노드 선택
    if (container.nodeType === Node.TEXT_NODE) {
      const block = container.parentElement?.closest(blockSelector);
      if (block && previewContent.contains(block)) blocks.add(block);
    } else {
      // 여러 요소에 걸친 선택 — TreeWalker로 블록 요소 수집
      const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'DIV', 'TD', 'TH']);
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_ELEMENT,
        {
          acceptNode(node) {
            return blockTags.has(node.tagName)
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          }
        }
      );

      let node;
      while ((node = walker.nextNode())) {
        if (range.intersectsNode(node) && previewContent.contains(node)) {
          blocks.add(node);
        }
      }

      // 블록을 못 찾으면 container 자체에서 closest 시도
      if (blocks.size === 0) {
        const el = container.nodeType === Node.ELEMENT_NODE
          ? container
          : container.parentElement;
        const block = el?.closest(blockSelector);
        if (block && previewContent.contains(block)) blocks.add(block);
      }
    }

    return Array.from(blocks);
  },

  handleDeleteSection() {
    // 현재 파란 테두리(활성 contenteditable 블록)를 찾아 그것만 삭제
    const sel = window.getSelection();
    let editableEl = null;

    if (sel && sel.rangeCount > 0) {
      let node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      editableEl = node.closest('[contenteditable="true"]');
    }
    // 폴백: 현재 포커스된 요소
    if (!editableEl && document.activeElement?.isContentEditable) {
      editableEl = document.activeElement;
    }

    if (!editableEl) {
      alert('삭제할 영역을 선택하세요.\n삭제할 블록 안을 클릭하거나 텍스트를 선택한 후 시도하세요.');
      return;
    }

    // 테이블 셀은 테이블 툴바에서 처리
    if (editableEl.tagName === 'TD' || editableEl.tagName === 'TH') {
      alert('셀 삭제는 테이블 편집 툴바를 사용하세요.');
      return;
    }

    // 삭제 대상 결정
    let target = editableEl;

    // li 하나만 남은 경우 → 부모 ul/ol 전체 삭제
    if (editableEl.tagName === 'LI') {
      const list = editableEl.closest('ul, ol');
      if (list && list.children.length === 1) target = list;
    }

    // 타이틀 영역(sec_title_wrap) 선택 시 → sec_wrap 전체 삭제 확인
    if (editableEl.closest('.sec_title_wrap')) {
      const secWrap = editableEl.closest('.sec_wrap');
      if (secWrap) {
        const titleEl = secWrap.querySelector('h3, h2');
        const titleText = titleEl ? titleEl.textContent.trim().slice(0, 20) : '이 섹션';
        if (!confirm(`"${titleText}" 섹션 전체를 삭제할까요?`)) return;
        target = secWrap;
      }
    }

    editHistory.pushMajor();
    target.remove();
    // 편집 모드에서 툴바는 항상 표시 유지 (hide 호출 금지)
    this.updateActiveStates();
    saveInlineEdits();
  },
};

// ============================================
// 테이블 편집 툴바
// ============================================

const tableToolbar = {
  element: null,
  activeTable: null,
  activeCell: null,
  selectedCells: new Set(),
  isDragging: false,
  dragStartCell: null,
  _dragStartX: 0,
  _dragStartY: 0,
  _dragThresholdMet: false,
  _cachedValign: null,
  _nearBorder: null,
  _colResize: null,

  init() {
    this.element = document.getElementById('table-toolbar');
    if (!this.element) return;

    this.element.querySelectorAll('button[data-tbl]').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.executeCommand(btn.dataset.tbl);
      });
    });

    // 배경색 피커
    const bgInput = document.getElementById('tbl-bgcolor-input');
    const bgLabel = this.element.querySelector('.tbl-color-btn');
    if (bgInput && bgLabel) {
      bgLabel.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // 네이티브 color picker가 input 위치를 기준으로 뜨는데, 뷰포트 하단에
        // 공간이 부족하면 위쪽으로 펼쳐 툴바(특히 '적용' 버튼)를 가림.
        // 클릭 직전에 input을 툴바 바로 아래로 옮겨 picker가 아래로 열리게 한다.
        try {
          const tbRect = this.element.getBoundingClientRect();
          bgInput.style.position = 'fixed';
          bgInput.style.left = Math.max(4, tbRect.left) + 'px';
          bgInput.style.top = (tbRect.bottom + 4) + 'px';
        } catch (_) {}
        bgInput.click();
      });
      bgInput.addEventListener('input', (e) => {
        const bar = document.getElementById('tbl-bgcolor-bar');
        if (bar) bar.style.background = e.target.value;
      });
      // change 이벤트에선 자동 적용 금지 — 네이티브 색상 피커가 열릴 때 셀 선택이
      // 유실돼 적용이 빗나감. 별도 "적용" 버튼에서 명시적으로 처리.
      bgInput.addEventListener('change', (e) => {
        const bar = document.getElementById('tbl-bgcolor-bar');
        if (bar) bar.style.background = e.target.value;
      });
      // 배경색 적용 버튼
      const bgApply = document.getElementById('tbl-bgcolor-apply');
      if (bgApply) {
        bgApply.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const color = bgInput.value || '#ffffff';
          this.applyBgColor(color);
        });
      }
    }

    // 테두리 패널 — 다중 선택 지원 (top/right/bottom/left 조합 가능, all은 단독)
    this._borderSides = new Set(['all']);
    this._borderStyle = 'solid';
    const borderBtn = document.getElementById('tbl-border-btn');
    const borderPanel = document.getElementById('tbl-border-panel');
    if (borderBtn && borderPanel) {
      borderBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        borderPanel.classList.toggle('hidden');
      });
      borderPanel.querySelectorAll('.tbl-border-side').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const side = btn.dataset.side;
          if (side === 'all') {
            // 전체 선택 시 다른 것 모두 해제
            this._borderSides = new Set(['all']);
          } else {
            // 개별 선택 시 'all' 해제, 토글
            this._borderSides.delete('all');
            if (this._borderSides.has(side)) {
              this._borderSides.delete(side);
            } else {
              this._borderSides.add(side);
            }
            // 모두 해제된 경우 'all' 기본 복구
            if (this._borderSides.size === 0) this._borderSides.add('all');
            // 모든 4면 선택된 경우 자동으로 'all'로 통합
            const fourSides = ['top', 'right', 'bottom', 'left'];
            if (fourSides.every(s => this._borderSides.has(s))) {
              this._borderSides = new Set(['all']);
            }
          }
          // UI 갱신
          borderPanel.querySelectorAll('.tbl-border-side').forEach(b => {
            b.classList.toggle('active', this._borderSides.has(b.dataset.side));
          });
        });
      });
      borderPanel.querySelectorAll('.tbl-border-style').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          borderPanel.querySelectorAll('.tbl-border-style').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._borderStyle = btn.dataset.style;
        });
      });
      const colorInput = document.getElementById('tbl-border-color');
      if (colorInput) {
        colorInput.addEventListener('input', (e) => {
          const bar = document.getElementById('tbl-border-color-bar');
          if (bar) bar.style.background = e.target.value;
        });
      }
      const applyBtn = document.getElementById('tbl-border-apply');
      if (applyBtn) {
        applyBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const width = document.getElementById('tbl-border-width')?.value || '1';
          const color = document.getElementById('tbl-border-color')?.value || '#000000';
          this.applyBorder(Array.from(this._borderSides), width, color);
          borderPanel.classList.add('hidden');
        });
      }
    }

    // 툴바/패널 외부 클릭 시 패널 닫기
    document.addEventListener('mousedown', (e) => {
      const panel = document.getElementById('tbl-border-panel');
      if (!panel || panel.classList.contains('hidden')) return;
      const btn = document.getElementById('tbl-border-btn');
      if (panel.contains(e.target) || btn?.contains(e.target)) return;
      panel.classList.add('hidden');
    });

    // 셀 너비 직접 입력 핸들러
    const widthApplyBtn = document.getElementById('tbl-col-width-apply');
    const widthInput = document.getElementById('tbl-col-width');
    const widthUnit = document.getElementById('tbl-col-width-unit');
    if (widthApplyBtn && widthInput && widthUnit) {
      const applyWidth = () => {
        const val = parseFloat(widthInput.value);
        if (!isFinite(val) || val <= 0) {
          alert('유효한 너비 값을 입력하세요.');
          return;
        }
        this.applyColumnWidth(val, widthUnit.value);
      };
      widthApplyBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyWidth();
      });
      widthInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applyWidth(); }
      });
      // 포커스 중 툴바가 숨지 않도록 mousedown stop
      [widthInput, widthUnit].forEach(el => {
        el.addEventListener('mousedown', (e) => e.stopPropagation());
      });
    }

    const preview = document.getElementById('preview-content');
    if (!preview) return;

    // 셀 클릭 → 셀 선택 시작
    preview.addEventListener('mousedown', (e) => {
      if (!state.editMode) return;
      // 열 너비 조정 핸들 클릭 시 resize 우선
      if (this._nearBorder) {
        this._startColResize(e, this._nearBorder);
        return;
      }
      const cell = e.target.closest('td, th');
      if (!cell) return;

      const table = cell.closest('table');
      if (!table) return;

      if (e.shiftKey && this.dragStartCell && this.dragStartCell.closest('table') === table) {
        // Shift+클릭 → 즉시 범위 선택
        this.selectRange(this.dragStartCell, cell);
        this._cellRangeMode = true;
      } else {
        // 일반 클릭 → 단일 셀 활성화. 논리적 선택은 유지하되 시각 클래스는
        // 생략하여 네이티브 텍스트 드래그에 양보 (명령 수행 시 activeCell 기준)
        this.clearSelection();
        this.dragStartCell = cell;
        this.selectedCells.add(cell);  // 명령어들이 selectedCells 기준이라 유지
        // tbl-cell-selected 클래스는 cross-cell 드래그 시에만 부여 (텍스트 드래그 방해 방지)
        this._cellRangeMode = false;
      }

      this.activeCell = cell;
      this.activeTable = table;
      this.isDragging = true;
      this._dragStartX = e.clientX;
      this._dragStartY = e.clientY;
      this._dragThresholdMet = false;
      this.showToolbar(table);
    });

    // 드래그로 셀 범위 선택 (다른 셀로 크로스 드래그 시에만 발동)
    preview.addEventListener('mousemove', (e) => {
      if (!this.isDragging || !state.editMode || !this.dragStartCell) return;
      // 드래그 임계값(6px) 미달 시 단순 클릭으로 간주, 범위 선택 방지
      if (!this._dragThresholdMet) {
        const dx = e.clientX - this._dragStartX;
        const dy = e.clientY - this._dragStartY;
        if (dx * dx + dy * dy < 36) return;
        this._dragThresholdMet = true;
      }
      const cell = e.target.closest('td, th');
      if (!cell) return;
      if (cell.closest('table') !== this.activeTable) return;
      // 같은 셀 내 드래그는 네이티브 텍스트 선택에 양보
      if (cell === this.dragStartCell && !this._cellRangeMode) return;
      // 다른 셀로 이동 → 셀 범위 선택 모드 활성화
      this._cellRangeMode = true;
      this.selectRange(this.dragStartCell, cell);
    });

    // 열 너비 조정: 셀 오른쪽 경계 근처 → col-resize 커서
    preview.addEventListener('mousemove', (e) => {
      if (!state.editMode || this.isDragging || this._colResize) {
        if (!this.isDragging && !this._colResize) {
          this._nearBorder = null;
          preview.style.cursor = '';
        }
        return;
      }
      const cell = e.target.closest('td, th');
      if (!cell) {
        this._nearBorder = null;
        preview.style.cursor = '';
        return;
      }
      const rect = cell.getBoundingClientRect();
      if (e.clientX >= rect.right - 6) {
        this._nearBorder = cell;
        preview.style.cursor = 'col-resize';
      } else {
        this._nearBorder = null;
        preview.style.cursor = '';
      }
    });

    preview.addEventListener('mouseleave', () => {
      if (!this._colResize) {
        this._nearBorder = null;
        preview.style.cursor = '';
      }
    });

    document.addEventListener('mousemove', (e) => { this._doColResize(e); });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      this._endColResize();
    });

    // 테이블 외부 클릭 → 툴바 숨김
    document.addEventListener('mousedown', (e) => {
      if (!this.element || !this.activeTable) return;
      if (this.element.contains(e.target)) return;
      const cell = e.target.closest('td, th');
      if (!cell || cell.closest('table') !== this.activeTable) {
        setTimeout(() => this.hide(), 80);
      }
    });

    // 스크롤 시 테이블 툴바 위치 재계산 (테이블에 따라 다님)
    const templatePreview = document.getElementById('template-preview');
    if (templatePreview) {
      templatePreview.addEventListener('scroll', () => {
        if (!this.activeTable || !state.editMode) return;
        this.showToolbar(this.activeTable);
      });
    }
  },

  /**
   * colspan/rowspan을 반영한 시각적 2D 그리드 생성
   * grid[row][col] = td/th 요소 (병합 셀은 모든 칸에 동일 참조)
   */
  buildGrid(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    const grid = rows.map(() => []);
    rows.forEach((row, ri) => {
      let ci = 0;
      Array.from(row.querySelectorAll('td, th')).forEach(cell => {
        while (grid[ri][ci]) ci++;           // rowspan으로 이미 채워진 칸 건너뜀
        const cs = parseInt(cell.getAttribute('colspan') || 1);
        const rs = parseInt(cell.getAttribute('rowspan') || 1);
        for (let r = ri; r < ri + rs && r < rows.length; r++) {
          for (let c = ci; c < ci + cs; c++) {
            grid[r][c] = cell;
          }
        }
        ci += cs;
      });
    });
    return { grid, rows };
  },

  /** 시각적 그리드에서 셀의 (row, col) 위치 반환 */
  getCellVisualPos(cell, grid) {
    for (let ri = 0; ri < grid.length; ri++) {
      for (let ci = 0; ci < grid[ri].length; ci++) {
        if (grid[ri][ci] === cell) return { row: ri, col: ci };
      }
    }
    return null;
  },

  selectRange(startCell, endCell) {
    const table = startCell.closest('table');
    if (!table || endCell.closest('table') !== table) return;

    const { grid } = this.buildGrid(table);
    const startPos = this.getCellVisualPos(startCell, grid);
    const endPos   = this.getCellVisualPos(endCell,   grid);
    if (!startPos || !endPos) return;

    const minRow = Math.min(startPos.row, endPos.row);
    const maxRow = Math.max(startPos.row, endPos.row);
    const minCol = Math.min(startPos.col, endPos.col);
    const maxCol = Math.max(startPos.col, endPos.col);

    this.clearSelection();
    // 시각적 범위 내 고유 셀 추가 (중복 참조 제거)
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = grid[r]?.[c];
        if (cell && !this.selectedCells.has(cell)) {
          this.selectedCells.add(cell);
          cell.classList.add('tbl-cell-selected');
        }
      }
    }
    // 선택 셀 기준으로 툴바 위치 재계산
    if (this.activeTable) this.showToolbar(this.activeTable);
  },

  clearSelection() {
    this.selectedCells.forEach(c => c.classList.remove('tbl-cell-selected'));
    this.selectedCells.clear();
  },

  showToolbar(table) {
    if (!this.element || !table) return;
    const templatePreview = document.getElementById('template-preview');
    if (!templatePreview) return;

    const previewRect = templatePreview.getBoundingClientRect();
    const scrollTop = templatePreview.scrollTop;
    const toolbarH = this.element.offsetHeight || 36;
    const toolbarW = this.element.offsetWidth || 600;

    // 기준 rect: 선택된 셀들이 있으면 그 영역, 없으면 activeCell, 없으면 테이블 전체
    let anchorRect;
    if (this.selectedCells.size > 0) {
      const cells = Array.from(this.selectedCells);
      const rects = cells.map(c => c.getBoundingClientRect());
      anchorRect = {
        top:    Math.min(...rects.map(r => r.top)),
        bottom: Math.max(...rects.map(r => r.bottom)),
        left:   Math.min(...rects.map(r => r.left)),
        right:  Math.max(...rects.map(r => r.right)),
      };
    } else if (this.activeCell) {
      anchorRect = this.activeCell.getBoundingClientRect();
    } else {
      anchorRect = table.getBoundingClientRect();
    }

    // 스크롤 영역 내 절대 위치로 변환
    const anchorTopAbs    = anchorRect.top    - previewRect.top + scrollTop;
    const anchorBottomAbs = anchorRect.bottom - previewRect.top + scrollTop;
    const anchorCenterX   = anchorRect.left   - previewRect.left + (anchorRect.right - anchorRect.left) / 2;

    // 이상적: 선택 셀 바로 위. 단 (1) 뷰포트 상단에 걸리거나,
    // (2) 테이블 위쪽 바깥 본문을 덮어버리면 셀 아래쪽으로 플립.
    const tableRect = table.getBoundingClientRect();
    const tableTopAbs = tableRect.top - previewRect.top + scrollTop;
    let top = anchorTopAbs - toolbarH - 6;
    if (top < scrollTop + 4 || top < tableTopAbs - 4) {
      top = anchorBottomAbs + 6;
    }

    // 가로: 선택 셀 중앙, 뷰포트 경계 클리핑
    const previewW = previewRect.width;
    let left = anchorCenterX;
    left = Math.max(toolbarW / 2 + 4, Math.min(left, previewW - toolbarW / 2 - 4));

    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
    this.element.classList.remove('hidden');
    this.updateHeaderButtons();
    this.updateAlignButtons();
    this.updateValignButtons();
    this.updateColWidthInput();
    this.updateNestedTableButton();
  },

  /** 선택 셀이 속한 열의 현재 너비를 입력 필드에 동기화 */
  updateColWidthInput() {
    const input = document.getElementById('tbl-col-width');
    const unitSel = document.getElementById('tbl-col-width-unit');
    if (!input || !unitSel) return;
    const cell = this.activeCell;
    const table = this.activeTable;
    if (!cell || !table) return;
    const cg = table.querySelector(':scope > colgroup');
    if (!cg) {
      // colgroup 없음 → 현재 렌더 폭을 px로 표시 (편집 시 ensureColgroup이 자동 생성)
      const rect = cell.getBoundingClientRect();
      input.value = Math.round(rect.width);
      unitSel.value = 'px';
      return;
    }
    const { grid } = this.buildGrid(table);
    const pos = this.getCellVisualPos(cell, grid);
    if (!pos) return;
    const cols = Array.from(cg.querySelectorAll('col'));
    const col = cols[pos.col];
    if (!col) return;
    const w = col.style.width || '';
    const match = w.match(/^([\d.]+)(%|px)$/);
    if (match) {
      input.value = parseFloat(match[1]).toFixed(1).replace(/\.0$/, '');
      unitSel.value = match[2];
    }
  },

  hide() {
    if (!this.element) return;
    this.element.classList.add('hidden');
    this.clearSelection();
    this.activeTable = null;
    this.activeCell = null;
    this.dragStartCell = null;
  },

  /** 헤더 버튼 active 상태 갱신 */
  updateHeaderButtons() {
    const table = this.activeTable;
    if (!table || !this.element) return;

    const firstRow = table.querySelector('tr');
    const rowCells = firstRow ? Array.from(firstRow.querySelectorAll('td, th')) : [];
    const isHeaderRow = rowCells.length > 0 && rowCells.every(c => c.tagName === 'TH');

    const allRows = Array.from(table.querySelectorAll('tr'));
    const firstCells = allRows.map(r => r.querySelector('td, th')).filter(Boolean);
    const isHeaderCol = firstCells.length > 0 && firstCells.every(c => c.tagName === 'TH');

    // 선택된 셀 기준으로 활성/비활성 버튼 상태 표시
    const targetCells = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : Array.from(table.querySelectorAll('td, th'));
    const hasAnyTd = targetCells.some(c => c.tagName === 'TD');
    const hasAnyTh = targetCells.some(c => c.tagName === 'TH');
    const activateBtn   = this.element.querySelector('[data-tbl="headerActivate"]');
    const deactivateBtn = this.element.querySelector('[data-tbl="headerDeactivate"]');
    if (activateBtn)   activateBtn.classList.toggle('active', !hasAnyTd && hasAnyTh);
    if (deactivateBtn) deactivateBtn.classList.toggle('active', !hasAnyTh && hasAnyTd);
  },

  // ── 열 너비 조정 ──────────────────────────────────────────────

  /** 테이블에 colgroup 없으면 현재 렌더 너비 기준으로 생성 */
  _ensureColgroup(table) {
    // 테이블 너비 100% 보장 (드래그 조정 중에도 유지되도록 방어)
    if (!table.hasAttribute('width')) table.setAttribute('width', '100%');
    table.style.width = '100%';
    table.style.tableLayout = 'fixed';

    let cg = table.querySelector(':scope > colgroup');
    if (cg) return cg;

    const { grid } = this.buildGrid(table);
    const colCount = Math.max(...grid.map(r => r.length), 0);
    if (!colCount) return null;

    const tableW = table.getBoundingClientRect().width || 600;
    cg = document.createElement('colgroup');
    const widths = [];
    for (let c = 0; c < colCount; c++) {
      let cellW = tableW / colCount;
      for (let r = 0; r < grid.length; r++) {
        const cell = grid[r]?.[c];
        if (cell && parseInt(cell.getAttribute('colspan') || 1) === 1) {
          cellW = cell.getBoundingClientRect().width || cellW;
          break;
        }
      }
      widths.push((cellW / tableW) * 100);
    }
    // 퍼센트 합계를 100%로 정규화 (반올림 오차로 총합이 틀어지는 것 방지)
    const total = widths.reduce((a, b) => a + b, 0) || 100;
    widths.forEach((w, i) => {
      const col = document.createElement('col');
      col.style.width = (w / total * 100).toFixed(2) + '%';
      cg.appendChild(col);
    });
    table.insertBefore(cg, table.firstChild);
    return cg;
  },

  _startColResize(e, cell) {
    const table = cell.closest('table');
    if (!table) return;
    const cg = this._ensureColgroup(table);
    if (!cg) return;
    const cols = Array.from(cg.querySelectorAll('col'));
    const { grid } = this.buildGrid(table);
    const pos = this.getCellVisualPos(cell, grid);
    if (!pos) return;

    e.preventDefault();
    e.stopPropagation();

    const tableW = table.getBoundingClientRect().width || 1;
    const toPct = (col) => {
      if (!col) return 0;
      const w = col.style.width;
      if (w.endsWith('%')) return parseFloat(w);
      if (w.endsWith('px')) return (parseFloat(w) / tableW) * 100;
      return 0;
    };

    this._colResize = {
      colIdx: pos.col,
      startX: e.clientX,
      tableW,
      startPct: toPct(cols[pos.col]),
      startNextPct: toPct(cols[pos.col + 1]),
      cols,
      table,
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  },

  _doColResize(e) {
    if (!this._colResize) return;
    const { colIdx, startX, tableW, startPct, startNextPct, cols, table } = this._colResize;
    const MIN_PCT = (20 / tableW) * 100;
    const deltaRaw = ((e.clientX - startX) / tableW) * 100;

    if (cols[colIdx + 1]) {
      // 좌/우 쌍으로 리사이즈: 두 열의 합은 항상 유지 (startPct + startNextPct)
      // newPct를 [MIN_PCT, startPct + startNextPct - MIN_PCT] 범위로 클램프
      const maxPct = startPct + startNextPct - MIN_PCT;
      const newPct = Math.min(maxPct, Math.max(MIN_PCT, startPct + deltaRaw));
      const actualDelta = newPct - startPct;
      cols[colIdx].style.width = newPct.toFixed(2) + '%';
      cols[colIdx + 1].style.width = (startNextPct - actualDelta).toFixed(2) + '%';
    } else if (cols[colIdx]) {
      // 마지막 열: 다음 열 없음 → 해당 열만 조정 (총합 보존 불가)
      const newPct = Math.max(MIN_PCT, startPct + deltaRaw);
      cols[colIdx].style.width = newPct.toFixed(2) + '%';
    }

    // 드래그 중 테이블 width 속성 소실 방지
    if (table && !table.hasAttribute('width')) {
      table.setAttribute('width', '100%');
    }
    if (table && table.style.width !== '100%') {
      table.style.width = '100%';
    }
  },

  _endColResize() {
    if (!this._colResize) return;
    const { table, cols } = this._colResize;
    // 종료 시점에 퍼센트 합계가 ~100%이 되도록 최종 정규화
    if (cols && cols.length) {
      const widths = cols.map(c => parseFloat(c.style.width) || 0);
      const total = widths.reduce((a, b) => a + b, 0);
      if (total > 0 && Math.abs(total - 100) > 0.1) {
        const scale = 100 / total;
        cols.forEach((c, i) => {
          c.style.width = (widths[i] * scale).toFixed(2) + '%';
        });
      }
    }
    // width 속성·스타일 복구
    if (table) {
      if (!table.hasAttribute('width')) table.setAttribute('width', '100%');
      table.style.width = '100%';
    }
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    this._colResize = null;
    this._nearBorder = null;
    saveInlineEdits();
  },

  // ── 셀 정렬 ───────────────────────────────────────────────────

  alignCells(align) {
    const table = this.activeTable;
    if (!table) return;
    const targets = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : (this.activeCell ? [this.activeCell] : []);
    if (!targets.length) return;
    targets.forEach(cell => { cell.style.textAlign = align; });
    this.updateAlignButtons();
    saveInlineEdits();
  },

  updateAlignButtons() {
    if (!this.element) return;
    const refCell = this.activeCell;
    const cur = refCell ? (refCell.style.textAlign || refCell.getAttribute('align') || '').toLowerCase() : '';
    ['Left', 'Center', 'Right'].forEach(a => {
      const btn = this.element.querySelector(`[data-tbl="align${a}"]`);
      if (!btn) return;
      const al = a.toLowerCase();
      const isActive = cur === al
        || (cur === '' && al === 'left')
        || (cur === 'start' && al === 'left')
        || (cur === 'end' && al === 'right');
      btn.classList.toggle('active', isActive);
    });
  },

  valignCells(valign) {
    const table = this.activeTable;
    if (!table) return;
    const targets = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : (this.activeCell ? [this.activeCell] : []);
    if (!targets.length) return;
    targets.forEach(cell => { cell.style.verticalAlign = valign; });
    this.updateValignButtons();
    saveInlineEdits();
  },

  updateValignButtons() {
    if (!this.element) return;
    const refCell = this.activeCell;
    const cur = refCell ? (refCell.style.verticalAlign || '').toLowerCase() : '';
    // 스크롤 시 60fps 호출되므로 변경 없으면 DOM 조작 스킵
    if (cur === this._cachedValign) return;
    this._cachedValign = cur;
    ['Top', 'Middle', 'Bottom'].forEach(v => {
      const btn = this.element.querySelector(`[data-tbl="valign${v}"]`);
      if (!btn) return;
      const vl = v.toLowerCase();
      btn.classList.toggle('active', cur === vl || (cur === '' && vl === 'middle'));
    });
  },

  /** 선택 셀(없으면 테이블 전체) td → th 변환 */
  activateHeader() {
    const table = this.activeTable;
    if (!table) return;
    const targets = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : Array.from(table.querySelectorAll('td'));
    this._convertCells(targets, 'th');
  },

  /** 선택 셀(없으면 테이블 전체) th → td 변환 */
  deactivateHeader() {
    const table = this.activeTable;
    if (!table) return;
    const targets = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : Array.from(table.querySelectorAll('th'));
    this._convertCells(targets, 'td');
  },

  /** 셀 태그 변환 공통 헬퍼 */
  _convertCells(cells, toTag) {
    cells.forEach(cell => {
      if (cell.tagName === toTag.toUpperCase()) return;
      const newCell = document.createElement(toTag);
      newCell.innerHTML = cell.innerHTML;
      Array.from(cell.attributes).forEach(a => newCell.setAttribute(a.name, a.value));
      newCell.classList.remove('tbl-cell-selected');  // 복사된 선택 클래스 제거
      if (state.editMode) newCell.setAttribute('contenteditable', 'true');
      cell.parentNode.replaceChild(newCell, cell);
    });
    this.clearSelection();  // Set 초기화 + 기존 셀 class 제거
    this.updateHeaderButtons();
    saveInlineEdits();
  },

  /** 선택 셀(없으면 activeCell)에 배경색 적용 */
  applyBgColor(color) {
    if (!state.editMode) return;
    const targets = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : (this.activeCell ? [this.activeCell] : []);
    if (!targets.length) return;
    targets.forEach(cell => { cell.style.backgroundColor = color; });
    saveInlineEdits();
    updateHtmlCode();
  },

  /**
   * 선택한 셀이 속한 열들의 너비를 직접 지정
   * @param {number} value - 너비 수치
   * @param {'%'|'px'} unit - 단위
   */
  applyColumnWidth(value, unit) {
    if (!state.editMode) return;
    const targets = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : (this.activeCell ? [this.activeCell] : []);
    if (!targets.length) {
      alert('너비를 적용할 셀을 먼저 선택하세요.');
      return;
    }
    const table = this.activeTable || targets[0].closest('table');
    if (!table) return;
    this._ensureColgroup(table);

    const { grid } = this.buildGrid(table);
    const cg = table.querySelector(':scope > colgroup');
    if (!cg) return;
    const cols = Array.from(cg.querySelectorAll('col'));

    // 선택 셀이 점유하는 모든 시각적 열 인덱스 수집
    const colIdxSet = new Set();
    targets.forEach(cell => {
      const pos = this.getCellVisualPos(cell, grid);
      if (!pos) return;
      const cs = parseInt(cell.getAttribute('colspan') || 1);
      for (let c = pos.col; c < pos.col + cs; c++) {
        colIdxSet.add(c);
      }
    });
    if (!colIdxSet.size) return;

    const widthStr = unit === 'px' ? `${value}px` : `${value}%`;
    colIdxSet.forEach(idx => {
      if (cols[idx]) cols[idx].style.width = widthStr;
    });

    // px 모드: tableLayout fixed 유지, table 자체 width 속성 유지
    if (unit === 'px') {
      // px 적용 시 table width="100%"가 퍼센트 열과 충돌하지 않도록 그대로 유지
      if (!table.hasAttribute('width')) table.setAttribute('width', '100%');
    }

    saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },

  /** 선택 셀에 테두리 적용 (sides: 'all'|'top'|'right'|'bottom'|'left' 또는 배열) */
  applyBorder(sides, widthPx, color) {
    if (!state.editMode) return;
    const targets = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : (this.activeCell ? [this.activeCell] : []);
    if (!targets.length) return;
    const style = this._borderStyle || 'solid';
    const val = (style === 'none' || widthPx === '0') ? 'none' : `${widthPx}px ${style} ${color}`;
    // 배열로 정규화 (단일 문자열도 허용하여 하위 호환)
    const sideList = Array.isArray(sides) ? sides : [sides];
    targets.forEach(cell => {
      if (sideList.includes('all')) {
        cell.style.border = val;
      } else {
        const propMap = { top: 'borderTop', right: 'borderRight', bottom: 'borderBottom', left: 'borderLeft' };
        sideList.forEach(side => {
          const prop = propMap[side];
          if (prop) cell.style[prop] = val;
        });
      }
    });
    saveInlineEdits();
    updateHtmlCode();
  },

  executeCommand(cmd) {
    editHistory.pushMajor(); // 테이블 조작 전 스냅샷 저장
    switch (cmd) {
      case 'mergeCell':    this.mergeCells(); break;
      case 'splitCell':    this.splitCell(); break;
      case 'addRowAbove':  this.addRow('above'); break;
      case 'addRowBelow':  this.addRow('below'); break;
      case 'deleteRow':    this.deleteRow(); break;
      case 'addColLeft':   this.addCol('left'); break;
      case 'addColRight':  this.addCol('right'); break;
      case 'deleteCol':    this.deleteCol(); break;
      case 'headerActivate':   this.activateHeader(); break;
      case 'headerDeactivate': this.deactivateHeader(); break;
      case 'alignLeft':   this.alignCells('left'); break;
      case 'alignCenter': this.alignCells('center'); break;
      case 'alignRight':  this.alignCells('right'); break;
      case 'valignTop':    this.valignCells('top'); break;
      case 'valignMiddle': this.valignCells('middle'); break;
      case 'valignBottom': this.valignCells('bottom'); break;
      case 'createNewTable': this.createNewTable(); break;
      case 'replaceTable':   this.createNewTable(true); break;
      case 'deleteTable':    this.deleteTable(); break;
      case 'insertNestedTable': this.insertNestedTable(); break;
      case 'splitCellByLines':  this.splitCellByLines(); break;
      case 'moveRowUp':    this.moveRow('up'); break;
      case 'moveRowDown':  this.moveRow('down'); break;
      case 'moveColLeft':  this.moveCol('left'); break;
      case 'moveColRight': this.moveCol('right'); break;
      case 'indentTable':  this.indentTable(); break;
      case 'outdentTable': this.outdentTable(); break;
    }
  },

  /**
   * 활성 테이블 전체를 오른쪽으로 18px 들여쓰기.
   * .table_x 래퍼가 있으면 래퍼에, 없으면 table 자체에 margin-left 적용.
   * width가 비어있거나 100%인 경우 calc(100% - Npx)로 보정해 오버플로우 방지.
   */
  indentTable() {
    const table = this.activeTable;
    if (!table) return;
    const wrapper = table.closest('.table_x') || table;
    const current = parseInt(wrapper.style.getPropertyValue('margin-left')) || 0;
    const newMargin = current + 18;
    wrapper.style.setProperty('margin-left', newMargin + 'px', 'important');
    if (!wrapper.style.width || wrapper.style.width === '100%' || wrapper.style.width.startsWith('calc(100%')) {
      wrapper.style.width = `calc(100% - ${newMargin}px)`;
    }
    if (typeof saveInlineEdits === 'function') saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },

  /**
   * 활성 테이블 전체를 왼쪽으로 18px 내어쓰기.
   * margin-left가 0이 되면 style 제거 (width calc 보정도 함께 제거).
   */
  outdentTable() {
    const table = this.activeTable;
    if (!table) return;
    const wrapper = table.closest('.table_x') || table;
    const current = parseInt(wrapper.style.getPropertyValue('margin-left')) || 0;
    const newMargin = Math.max(0, current - 18);
    if (newMargin) {
      wrapper.style.setProperty('margin-left', newMargin + 'px', 'important');
      if (!wrapper.style.width || wrapper.style.width === '100%' || wrapper.style.width.startsWith('calc(100%')) {
        wrapper.style.width = `calc(100% - ${newMargin}px)`;
      }
    } else {
      wrapper.style.removeProperty('margin-left');
      // width가 calc(100% - ...)인 경우에만 제거 (사용자 지정 width 보존)
      if (wrapper.style.width && wrapper.style.width.startsWith('calc(100%')) {
        wrapper.style.removeProperty('width');
      }
    }
    if (typeof saveInlineEdits === 'function') saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },

  /** 활성 테이블 전체 삭제 (.table_x 래퍼 포함) */
  deleteTable() {
    const table = this.activeTable;
    if (!table) {
      alert('삭제할 테이블을 먼저 선택하세요.');
      return;
    }
    if (!confirm('이 테이블을 삭제하시겠습니까?')) return;
    const wrapper = table.closest('.table_x') || table;
    wrapper.remove();
    this.activeTable = null;
    this.activeCell = null;
    this.clearSelection();
    this.hide();
    if (typeof saveInlineEdits === 'function') saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },

  /**
   * 신규 테이블 생성 또는 현재 테이블 교체
   * @param {boolean} replaceCurrent - true면 활성 테이블 교체, false면 커서 위치 삽입
   *   - 커서가 <td>/<th> 내부에 있으면 자동으로 중첩 테이블로 삽입 (stable fs15 클래스)
   */
  createNewTable(replaceCurrent = false) {
    const input = prompt('행×열 (예: 3x4 또는 3,4) — 첫 행은 헤더로 생성됩니다', '3x3');
    if (!input) return;
    const match = input.trim().match(/^(\d+)\s*[x×,*]\s*(\d+)$/i);
    if (!match) {
      alert('형식: 3x4 또는 3,4 형태로 입력하세요.');
      return;
    }
    const rows = parseInt(match[1], 10);
    const cols = parseInt(match[2], 10);
    if (rows < 1 || cols < 1 || rows > 50 || cols > 20) {
      alert('행 1~50, 열 1~20 범위로 입력하세요.');
      return;
    }
    const includeHeader = confirm('첫 행을 헤더(<th>)로 만드시겠습니까? (취소 = 모든 셀 <td>)');

    // 인크루트 표준 템플릿으로 HTML 생성
    // 편집 모드면 contenteditable 즉시 부여 (setupInlineEditors가 &nbsp;만 있는 셀을 스킵하므로 필수)
    const ceAttr = state.editMode ? ' contenteditable="true"' : '';
    let rowsHtml = '';
    for (let r = 0; r < rows; r++) {
      let cellsHtml = '';
      for (let c = 0; c < cols; c++) {
        const isHeader = includeHeader && r === 0;
        const tag = isHeader ? 'th' : 'td';
        cellsHtml += `<${tag}${ceAttr}>&nbsp;</${tag}>`;
      }
      rowsHtml += `<tr>${cellsHtml}</tr>`;
    }
    // 외곽 테이블 (table_x 래퍼)
    const outerHtml = `<div class="table_x"><table width="100%" border="1" class="table_type bTable_1"><tbody>${rowsHtml}</tbody></table></div>`;
    // 중첩 테이블 (table_x 래퍼 없이 stable fs15 클래스)
    const nestedHtml = `<table width="100%" border="1" class="table_type bTable_1 stable fs15"><tbody>${rowsHtml}</tbody></table>`;

    // 커서 위치 파악 → 셀 내부인지 판단
    const preview = document.getElementById('template-preview');
    const sel = window.getSelection();
    let targetCell = null;
    let cursorRange = null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (preview && preview.contains(range.commonAncestorContainer)) {
        cursorRange = range;
        let node = range.commonAncestorContainer;
        if (node.nodeType === 3) node = node.parentElement;
        targetCell = node ? node.closest('td, th') : null;
      }
    }
    // 커서가 셀에 없으면 activeCell 폴백 (툴바에서 최근 선택한 셀)
    if (!targetCell && this.activeCell) targetCell = this.activeCell;

    // 1) 활성 테이블 교체 모드
    if (replaceCurrent && this.activeTable) {
      const wrapper = this.activeTable.closest('.table_x') || this.activeTable;
      const isNestedContext = wrapper.closest('td, th') != null;
      const temp = document.createElement('div');
      temp.innerHTML = isNestedContext ? nestedHtml : outerHtml;
      const newEl = temp.firstElementChild;
      if (newEl && wrapper.parentNode) {
        wrapper.parentNode.replaceChild(newEl, wrapper);
        this.activeTable = newEl.tagName === 'TABLE' ? newEl : newEl.querySelector('table');
      }
    }
    // 2) 셀 내부 → 중첩 테이블 삽입 (커서 위치에)
    else if (targetCell) {
      const temp = document.createElement('div');
      temp.innerHTML = nestedHtml;
      const newTable = temp.firstElementChild;
      if (!newTable) return;
      if (cursorRange && targetCell.contains(cursorRange.commonAncestorContainer)) {
        // 커서 위치에 삽입: 현재 인라인 흐름 뒤로
        cursorRange.collapse(false);
        cursorRange.insertNode(newTable);
      } else {
        // 셀 맨 끝에 추가
        targetCell.appendChild(newTable);
      }
      this.activeTable = newTable;
    }
    // 3) 셀 바깥 → 외곽 테이블 삽입 (커서 블록 뒤에)
    else {
      const temp = document.createElement('div');
      temp.innerHTML = outerHtml;
      const newWrapper = temp.firstElementChild;
      if (!newWrapper) return;
      let inserted = false;
      if (cursorRange) {
        let blockParent = cursorRange.commonAncestorContainer;
        if (blockParent.nodeType === 3) blockParent = blockParent.parentElement;
        const block = blockParent.closest('p, div, li, h1, h2, h3, ul, ol, section');
        if (block && block.parentNode && block !== preview) {
          block.parentNode.insertBefore(newWrapper, block.nextSibling);
          inserted = true;
        }
      }
      if (!inserted && preview) preview.appendChild(newWrapper);
      this.activeTable = newWrapper.querySelector('table');
    }

    if (typeof saveInlineEdits === 'function') saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },

  mergeCells() {
    if (this.selectedCells.size < 2) {
      alert('병합할 셀을 2개 이상 선택하세요.\n(드래그 또는 Shift+클릭으로 범위 선택)');
      return;
    }

    const table = this.activeTable;
    if (!table) return;
    // 구조 변경 전 colgroup 확정 → 다른 셀 너비 재분배 방지
    this._ensureColgroup(table);
    const { grid } = this.buildGrid(table);

    // 선택된 셀들의 시각적 위치 수집
    const positions = [];
    this.selectedCells.forEach(cell => {
      const pos = this.getCellVisualPos(cell, grid);
      if (pos) positions.push({ cell, ...pos });
    });
    if (positions.length < 2) return;

    const minRow = Math.min(...positions.map(p => p.row));
    const maxRow = Math.max(...positions.map(p => p.row));
    const minCol = Math.min(...positions.map(p => p.col));
    const maxCol = Math.max(...positions.map(p => p.col));

    // 기준 셀: 시각적 좌상단 (minRow·minCol 위치의 셀)
    const anchor = grid[minRow]?.[minCol];
    if (!anchor) return;

    // 나머지 고유 셀들의 내용을 anchor에 병합
    const seen = new Set([anchor]);
    let mergedContent = anchor.innerHTML;
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cell = grid[r]?.[c];
        if (cell && !seen.has(cell)) {
          seen.add(cell);
          if (cell.innerHTML.trim()) mergedContent += '<br>' + cell.innerHTML;
        }
      }
    }
    anchor.innerHTML = mergedContent;
    anchor.setAttribute('colspan', maxCol - minCol + 1);
    anchor.setAttribute('rowspan', maxRow - minRow + 1);

    seen.forEach(cell => { if (cell !== anchor) cell.remove(); });

    this.clearSelection();
    this.selectedCells.add(anchor);
    anchor.classList.add('tbl-cell-selected');
    this.activeCell = anchor;
    saveInlineEdits();
  },

  splitCell() {
    const cell = this.activeCell;
    if (!cell) return;

    const colspan = parseInt(cell.getAttribute('colspan') || 1);
    const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
    if (colspan <= 1 && rowspan <= 1) {
      alert('이미 단일 셀입니다. (colspan=1, rowspan=1)');
      return;
    }

    const table = cell.closest('table');
    if (!table) return;
    this._ensureColgroup(table);  // 너비 재분배 방지

    // 시각적 그리드에서 이 셀의 위치 파악
    const { grid, rows } = this.buildGrid(table);
    const pos = this.getCellVisualPos(cell, grid);
    if (!pos) return;

    const tag = cell.tagName.toLowerCase();
    cell.removeAttribute('colspan');
    cell.removeAttribute('rowspan');

    // colspan 복원 — 같은 행에 오른쪽으로 빈 셀 추가
    for (let c = 1; c < colspan; c++) {
      const newCell = document.createElement(tag);
      newCell.innerHTML = '';
      if (state.editMode) newCell.setAttribute('contenteditable', 'true');
      cell.after(newCell);
    }

    // rowspan 복원 — 아래 행에 빈 셀 삽입 (시각적 위치 기준)
    for (let r = 1; r < rowspan; r++) {
      const targetRow = rows[pos.row + r];
      if (!targetRow) continue;
      // 삽입 위치: 시각적 col(pos.col) 이후의 첫 실제 DOM 셀
      const { grid: newGrid } = this.buildGrid(table);
      const insertBeforeCell = newGrid[pos.row + r]?.[pos.col + colspan] || null;
      for (let c = 0; c < colspan; c++) {
        const newCell = document.createElement(tag);
        newCell.innerHTML = '';
        if (state.editMode) newCell.setAttribute('contenteditable', 'true');
        if (insertBeforeCell) targetRow.insertBefore(newCell, insertBeforeCell);
        else targetRow.appendChild(newCell);
      }
    }

    saveInlineEdits();
  },

  addRow(position) {
    const cell = this.activeCell;
    if (!cell) return;

    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return;
    this._ensureColgroup(table);  // 너비 재분배 방지

    // 열 수 = 시각적 그리드의 너비
    const { grid } = this.buildGrid(table);
    const colCount = Math.max(...grid.map(r => r.length));

    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const newCell = document.createElement('td');
      newCell.innerHTML = '&nbsp;';
      if (state.editMode) newCell.setAttribute('contenteditable', 'true');
      newRow.appendChild(newCell);
    }

    if (position === 'above') row.parentNode.insertBefore(newRow, row);
    else row.parentNode.insertBefore(newRow, row.nextSibling);

    saveInlineEdits();
  },

  deleteRow() {
    const cell = this.activeCell;
    if (!cell) return;

    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table) return;
    this._ensureColgroup(table);  // 너비 재분배 방지

    if (table.querySelectorAll('tr').length <= 1) {
      alert('마지막 행은 삭제할 수 없습니다.');
      return;
    }

    row.remove();
    this.activeCell = null;
    saveInlineEdits();
  },

  addCol(position) {
    const cell = this.activeCell;
    if (!cell) return;

    const table = cell.closest('table');
    if (!table) return;
    this._ensureColgroup(table);  // 너비 재분배 방지

    const { grid, rows } = this.buildGrid(table);
    const pos = this.getCellVisualPos(cell, grid);
    if (!pos) return;

    // 삽입할 시각적 열 번호
    const insertColIdx = position === 'left' ? pos.col : pos.col + 1;

    rows.forEach((row, ri) => {
      // 이 행에서 insertColIdx 위치의 셀 찾기
      const refCell = grid[ri]?.[insertColIdx] || null;
      const isHeader = refCell?.tagName === 'TH' || grid[ri]?.[pos.col]?.tagName === 'TH';
      const newCell = document.createElement(isHeader ? 'th' : 'td');
      newCell.innerHTML = '&nbsp;';
      if (state.editMode) newCell.setAttribute('contenteditable', 'true');

      // 이미 삽입했으면 skip (rowspan으로 같은 셀이 여러 행에 등장)
      if (position === 'left') {
        if (refCell && refCell.parentNode === row) row.insertBefore(newCell, refCell);
        else if (!refCell) row.appendChild(newCell);
      } else {
        if (refCell && refCell.parentNode === row) row.insertBefore(newCell, refCell);
        else row.appendChild(newCell);
      }
    });

    // colgroup에 새 <col> 삽입 (기준 열의 너비를 반으로 나눔)
    const cg = table.querySelector(':scope > colgroup');
    if (cg) {
      const cols = Array.from(cg.querySelectorAll('col'));
      const refCol = cols[pos.col];
      const refPct = refCol ? parseFloat(refCol.style.width) || 0 : 0;
      const halfPct = refPct / 2;
      const newCol = document.createElement('col');
      newCol.style.width = halfPct.toFixed(2) + '%';
      if (refCol) refCol.style.width = halfPct.toFixed(2) + '%';
      const insertBeforeCol = cols[insertColIdx] || null;
      if (insertBeforeCol) cg.insertBefore(newCol, insertBeforeCol);
      else cg.appendChild(newCol);
    }

    saveInlineEdits();
  },

  deleteCol() {
    const cell = this.activeCell;
    if (!cell) return;

    const table = cell.closest('table');
    if (!table) return;
    this._ensureColgroup(table);  // 너비 재분배 방지

    const { grid, rows } = this.buildGrid(table);
    const pos = this.getCellVisualPos(cell, grid);
    if (!pos) return;

    // 시각적 그리드 너비
    const colCount = Math.max(...grid.map(r => r.length));
    if (colCount <= 1) {
      alert('마지막 열은 삭제할 수 없습니다.');
      return;
    }

    const toRemove = new Set();
    rows.forEach((row, ri) => {
      const target = grid[ri]?.[pos.col];
      if (target && target.parentNode === row) toRemove.add(target);
    });
    toRemove.forEach(c => c.remove());

    // colgroup에서 해당 <col> 제거 + 삭제된 너비를 인접 col에 흡수
    const cg = table.querySelector(':scope > colgroup');
    if (cg) {
      const cols = Array.from(cg.querySelectorAll('col'));
      const removedCol = cols[pos.col];
      if (removedCol) {
        const removedPct = parseFloat(removedCol.style.width) || 0;
        // 인접 col(우선 오른쪽, 없으면 왼쪽)에 흡수
        const absorbTarget = cols[pos.col + 1] || cols[pos.col - 1];
        if (absorbTarget) {
          const targetPct = parseFloat(absorbTarget.style.width) || 0;
          absorbTarget.style.width = (targetPct + removedPct).toFixed(2) + '%';
        }
        removedCol.remove();
      }
    }

    this.activeCell = null;
    saveInlineEdits();
  },

  // ── (a) 셀 → 하위 표 삽입 ────────────────────────────────────
  /** activeCell 내부에 중첩 테이블을 강제 삽입 (숨은 기능의 명시적 버튼). */
  insertNestedTable() {
    if (!state.editMode) return;
    if (!this.activeCell) {
      alert('셀을 먼저 선택하세요.');
      return;
    }
    const input = prompt('행×열 (예: 2x2 또는 3,3)', '2x2');
    if (!input) return;
    const match = input.trim().match(/^(\d+)\s*[x×,*]\s*(\d+)$/i);
    if (!match) {
      alert('형식: 2x2 또는 2,2 형태로 입력하세요.');
      return;
    }
    const rows = parseInt(match[1], 10);
    const cols = parseInt(match[2], 10);
    if (rows < 1 || cols < 1 || rows > 50 || cols > 20) {
      alert('행 1~50, 열 1~20 범위로 입력하세요.');
      return;
    }

    const ceAttr = state.editMode ? ' contenteditable="true"' : '';
    let rowsHtml = '';
    for (let r = 0; r < rows; r++) {
      let cellsHtml = '';
      for (let c = 0; c < cols; c++) {
        cellsHtml += `<td${ceAttr}>&nbsp;</td>`;
      }
      rowsHtml += `<tr>${cellsHtml}</tr>`;
    }
    const nestedHtml = `<table width="100%" border="1" class="table_type bTable_1 stable fs15"><tbody>${rowsHtml}</tbody></table>`;

    const cell = this.activeCell;
    const temp = document.createElement('div');
    temp.innerHTML = nestedHtml;
    const newTable = temp.firstElementChild;
    if (!newTable) return;

    // 현재 커서가 이 셀 내부에 있으면 커서 위치에, 아니면 셀 끝에 삽입
    const sel = window.getSelection();
    let cursorRange = null;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (cell.contains(range.commonAncestorContainer)) cursorRange = range;
    }
    if (cursorRange) {
      cursorRange.collapse(false);
      cursorRange.insertNode(newTable);
    } else {
      cell.appendChild(newTable);
    }
    this.activeTable = newTable;

    if (typeof saveInlineEdits === 'function') saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },

  /** insertNestedTable 버튼의 활성/비활성 상태 갱신 (activeCell 있을 때만 활성) */
  updateNestedTableButton() {
    if (!this.element) return;
    const btn = this.element.querySelector('[data-tbl="insertNestedTable"]');
    if (!btn) return;
    const hasCell = !!this.activeCell;
    btn.classList.toggle('tbl-btn-disabled', !hasCell);
    if (!hasCell) btn.title = '셀을 먼저 선택하세요';
    else          btn.title = '선택한 셀 안에 하위 표를 삽입합니다';
  },

  // ── (b) 셀 텍스트 → 줄별 행 분할 ─────────────────────────────
  /** 셀의 줄 단위 분리. <p>, <br>, \n 중 가장 자연스러운 구분자 하나로. */
  _splitCellLines(cell) {
    const html = cell.innerHTML || '';
    // 1) <p> 블록이 2개 이상이면 <p>를 기준으로
    const pMatches = html.match(/<p[\s>][\s\S]*?<\/p>/gi);
    if (pMatches && pMatches.length >= 2) {
      return pMatches.map(p => p.replace(/^<p[\s>][\s\S]*?>/i, '').replace(/<\/p>$/i, '').trim()).filter(s => s.length > 0);
    }
    // 2) <br>이 포함되어 있으면 <br> 기준
    if (/<br\s*\/?>/i.test(html)) {
      return html.split(/<br\s*\/?>/i).map(s => s.trim()).filter(s => s.length > 0);
    }
    // 3) 일반 텍스트 개행 기준
    const text = cell.textContent || '';
    if (text.indexOf('\n') !== -1) {
      return text.split(/\r?\n/).map(s => s.trim()).filter(s => s.length > 0);
    }
    // 4) 줄이 하나뿐
    const single = (text || '').trim();
    return single ? [single] : [];
  },

  splitCellByLines() {
    if (!state.editMode) return;
    const targets = this.selectedCells.size > 0
      ? Array.from(this.selectedCells)
      : (this.activeCell ? [this.activeCell] : []);
    if (!targets.length) {
      alert('분할할 셀을 먼저 선택하세요.');
      return;
    }

    // 모두 같은 <tr> 소속인지 확인
    const tr = targets[0].closest('tr');
    if (!tr || !targets.every(c => c.closest('tr') === tr)) {
      alert('같은 행의 셀만 선택하세요.');
      return;
    }

    // 병합 셀 차단
    const hasMerge = targets.some(c =>
      parseInt(c.getAttribute('rowspan') || 1) > 1 ||
      parseInt(c.getAttribute('colspan') || 1) > 1
    );
    if (hasMerge) {
      alert('병합된 셀은 분할할 수 없습니다.');
      return;
    }

    // 각 셀의 줄 배열
    const linesByCell = targets.map(c => this._splitCellLines(c));
    const maxLines = Math.max(...linesByCell.map(l => l.length));
    if (maxLines <= 1) {
      alert('분할할 줄이 없습니다.');
      return;
    }

    // 원 행의 DOM 셀 개수·각 셀의 cellIndex를 기준으로 새 행 구성
    const rowCells = Array.from(tr.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH');
    const rowCellCount = rowCells.length;
    // 선택 셀의 cellIndex(원 행 내 DOM 위치)
    const targetIdxList = targets.map(c => rowCells.indexOf(c));

    // 현재 셀(들): 첫 줄만 남기기
    targets.forEach((c, i) => {
      const lines = linesByCell[i];
      const first = lines[0] || '';
      c.innerHTML = first || '&nbsp;';
    });

    // maxLines-1 개 새 행 생성 (원 행 바로 아래)
    const ceAttr = state.editMode ? ' contenteditable="true"' : '';
    const parent = tr.parentNode;
    let insertAfter = tr;
    for (let k = 1; k < maxLines; k++) {
      const newRow = document.createElement('tr');
      for (let idx = 0; idx < rowCellCount; idx++) {
        const td = document.createElement('td');
        if (state.editMode) td.setAttribute('contenteditable', 'true');
        // 이 DOM 인덱스가 선택된 셀 중 하나인지 확인
        const sel = targetIdxList.indexOf(idx);
        if (sel >= 0) {
          const line = linesByCell[sel][k];
          td.innerHTML = (line && line.length > 0) ? line : '&nbsp;';
        } else {
          td.innerHTML = '&nbsp;';
        }
        newRow.appendChild(td);
      }
      parent.insertBefore(newRow, insertAfter.nextSibling);
      insertAfter = newRow;
    }

    if (typeof saveInlineEdits === 'function') saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },

  // ── (d) 행/열 이동 ────────────────────────────────────────────
  /** tr 자체에 rowspan>1 셀이 있는지. */
  _rowHasRowspan(tr) {
    if (!tr) return false;
    return Array.from(tr.children).some(c =>
      (c.tagName === 'TD' || c.tagName === 'TH') && parseInt(c.getAttribute('rowspan') || 1) > 1
    );
  },

  /** 두 행이 걸쳐있는 rowspan이 있는지 (이전 행의 rowspan이 아래로 내려와 있을 수도 있으므로 그리드로 판정). */
  _rowsHaveVerticalMerge(table, trA, trB) {
    const { grid, rows } = this.buildGrid(table);
    const iA = rows.indexOf(trA);
    const iB = rows.indexOf(trB);
    if (iA < 0 || iB < 0) return false;
    // 각 행의 모든 셀에 대해 rowspan>1이면 걸침
    const checkRow = (idx) => grid[idx]?.some(cell => cell && parseInt(cell.getAttribute('rowspan') || 1) > 1);
    // 또한, 같은 시각적 열에서 두 행에 걸쳐 동일 셀이 나타나면 병합 걸침
    if (checkRow(iA) || checkRow(iB)) return true;
    const len = Math.max(grid[iA]?.length || 0, grid[iB]?.length || 0);
    for (let c = 0; c < len; c++) {
      if (grid[iA]?.[c] && grid[iA][c] === grid[iB]?.[c]) return true;
    }
    return false;
  },

  moveRow(direction) {
    if (!state.editMode) return;
    const cell = this.activeCell;
    if (!cell) { alert('이동할 행의 셀을 먼저 선택하세요.'); return; }
    const tr = cell.closest('tr');
    const table = cell.closest('table');
    if (!tr || !table) return;

    const neighbor = direction === 'up' ? tr.previousElementSibling : tr.nextElementSibling;
    if (!neighbor || neighbor.tagName !== 'TR') return; // no-op

    // 병합 차단: 두 행 중 하나라도 rowspan 걸침이 있으면 불가
    if (this._rowsHaveVerticalMerge(table, tr, neighbor)) {
      alert('병합 셀이 있는 행은 이동할 수 없습니다.');
      return;
    }

    // 두 <tr> 자리 교환
    const parent = tr.parentNode;
    if (direction === 'up') {
      parent.insertBefore(tr, neighbor);
    } else {
      parent.insertBefore(neighbor, tr);
    }

    if (typeof saveInlineEdits === 'function') saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },

  moveCol(direction) {
    if (!state.editMode) return;
    const cell = this.activeCell;
    if (!cell) { alert('이동할 열의 셀을 먼저 선택하세요.'); return; }
    const table = cell.closest('table');
    if (!table) return;

    const { grid, rows } = this.buildGrid(table);
    const pos = this.getCellVisualPos(cell, grid);
    if (!pos) return;
    const c = pos.col;
    const colCount = Math.max(...grid.map(r => r.length));

    const c2 = direction === 'left' ? c - 1 : c + 1;
    if (c2 < 0 || c2 >= colCount) return; // no-op

    // 병합 차단: 어느 한 행이라도 교환 대상 두 시각적 열이 같은 셀이거나
    // 교환 대상 셀의 colspan/rowspan이 1을 초과하면 중단
    for (let r = 0; r < grid.length; r++) {
      const a = grid[r]?.[c];
      const b = grid[r]?.[c2];
      if (!a || !b) continue;
      if (a === b) { alert('병합 셀이 있는 열은 이동할 수 없습니다.'); return; }
      const aCs = parseInt(a.getAttribute('colspan') || 1);
      const aRs = parseInt(a.getAttribute('rowspan') || 1);
      const bCs = parseInt(b.getAttribute('colspan') || 1);
      const bRs = parseInt(b.getAttribute('rowspan') || 1);
      if (aCs > 1 || aRs > 1 || bCs > 1 || bRs > 1) {
        alert('병합 셀이 있는 열은 이동할 수 없습니다.');
        return;
      }
    }

    // 각 행에서 cells[c]와 cells[c2] 교환. (병합이 없다는 것이 확인되었으므로
    // grid 좌표와 각 tr의 실제 cellIndex는 동일하다고 가정 가능)
    rows.forEach((row, ri) => {
      const a = grid[ri]?.[c];
      const b = grid[ri]?.[c2];
      if (!a || !b || a === b) return;
      if (a.parentNode !== row || b.parentNode !== row) return;
      // DOM 기준 순서를 결정: c < c2 (오른쪽 이동) 또는 c > c2 (왼쪽 이동)
      if (c < c2) {
        // a가 왼쪽, b가 오른쪽 → b를 a 앞으로
        row.insertBefore(b, a);
      } else {
        // c > c2: a가 오른쪽, b가 왼쪽 → a를 b 앞으로
        row.insertBefore(a, b);
      }
    });

    // colgroup <col>도 교환 (있을 때)
    const cg = table.querySelector(':scope > colgroup');
    if (cg) {
      const cols = Array.from(cg.querySelectorAll('col'));
      const colA = cols[c];
      const colB = cols[c2];
      if (colA && colB) {
        if (c < c2) cg.insertBefore(colB, colA);
        else        cg.insertBefore(colA, colB);
      }
    }

    if (typeof saveInlineEdits === 'function') saveInlineEdits();
    if (typeof updateHtmlCode === 'function') updateHtmlCode();
  },
};

// ============================================
// CodeMirror VS Code 스타일 코드 에디터 초기화
// ============================================

function initCodeMirrorEditor() {
  const textarea = document.getElementById('html-code');
  if (!textarea || typeof CodeMirror === 'undefined') return;

  const wrap = document.getElementById('html-code-editor-wrap');

  const cm = CodeMirror(wrap, {
    value: textarea.value || '',
    mode: 'htmlmixed',
    theme: 'material-darker',
    lineNumbers: true,
    lineWrapping: false,
    indentWithTabs: false,
    indentUnit: 2,
    tabSize: 2,
    autoCloseTags: true,
    matchBrackets: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    extraKeys: {
      'Ctrl-Enter': () => {
        const e = new KeyboardEvent('keydown', { ctrlKey: true, key: 'Enter', bubbles: true });
        keydownListeners.forEach(fn => fn(e));
      },
      'Cmd-Enter': () => {
        const e = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter', bubbles: true });
        keydownListeners.forEach(fn => fn(e));
      },
    },
  });

  // textarea 숨기기 (CodeMirror가 직접 wrap에 붙음)
  textarea.style.display = 'none';

  window._cmEditor = cm;

  // 이벤트 리스너 저장소
  const inputListeners = [];
  const keydownListeners = [];

  cm.on('change', (_cm, change) => {
    // programmatic setValue는 origin이 'setValue' → input 이벤트 발생 안 함
    if (change.origin === 'setValue') return;
    inputListeners.forEach(fn => fn({ target: elements.htmlCode }));
  });

  // elements.htmlCode를 CodeMirror 프록시로 교체
  elements.htmlCode = {
    get value() { return cm.getValue(); },
    set value(v) { cm.setValue(v || ''); },
    addEventListener(event, handler) {
      if (event === 'input') inputListeners.push(handler);
      else if (event === 'keydown') keydownListeners.push(handler);
    },
    removeEventListener() {},
    focus() { cm.focus(); },
  };
}

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  initCodeMirrorEditor();
  floatingToolbar.init();
  tableToolbar.init();
  setupPanelSelectAll();
  setupEditUndoRedo();
  setupSplitViewSync();
  setupSplitViewPositionSync();
});

// ============================================
// 편집 모드 Undo / Redo 키보드 핸들러
// ============================================

function setupEditUndoRedo() {
  document.addEventListener('keydown', (e) => {
    if (!state.editMode) return;

    // Enter — contenteditable 안에서 <br> 삽입 (새 단락 대신)
    // ul/ol 안에서는 기본 동작 유지 (새 <li> 생성)
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const active = document.activeElement;
      if (active && active.isContentEditable) {
        const sel = window.getSelection();
        let node = sel?.anchorNode;
        if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
        // li는 li 자체가 contenteditable이므로 ul/ol 안에서도 <br> 삽입 (새 li 생성 안 함)
        e.preventDefault();
        document.execCommand('insertHTML', false, '<br>');
        floatingToolbar.afterCommand();
        return;
      }
    }

    if (!e.ctrlKey && !e.metaKey) return;

    // Ctrl+Shift+S — 취소선
    if (e.shiftKey && e.key.toLowerCase() === 's') {
      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        document.execCommand('strikeThrough', false, null);
        floatingToolbar.updateActiveStates();
        floatingToolbar.afterCommand();
        return;
      }
    }

    const isUndo = !e.shiftKey && e.key === 'z';
    const isRedo = e.key === 'y' || (e.shiftKey && e.key === 'z');

    if (!isUndo && !isRedo) return;

    // input/textarea/select에 포커스 중이면 브라우저 기본 동작 유지
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (isUndo) {
      if (editHistory.past.length > 0) {
        e.preventDefault();
        // contenteditable 안에 있으면 먼저 blur → 편집 종료 후 undo
        if (document.activeElement?.isContentEditable) {
          document.activeElement.blur();
        }
        editHistory.undo();
      }
    }

    if (isRedo) {
      e.preventDefault();
      if (document.activeElement?.isContentEditable) {
        document.activeElement.blur();
      }
      editHistory.redo();
    }
  });
}

// ============================================
// 코드+뷰 분할 모드 실시간 동기화
// ============================================

function setupSplitViewSync() {
  let debounceTimer;

  // 코드 → 미리보기: textarea 수정 시 300ms 디바운스 후 미리보기 갱신
  elements.htmlCode.addEventListener('input', () => {
    if (state.activeView !== 'split') return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const html = elements.htmlCode.value;
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const newTC = tmp.querySelector('#templwrap_v3 .templ_content');

      // 기존 .templ_content가 있으면 내용만 교체 → 깜빡임 방지
      const existingTC = elements.previewContent.querySelector('#templwrap_v3 .templ_content');
      if (newTC && existingTC) {
        existingTC.innerHTML = newTC.innerHTML;
        applyIncruitTableClassesToDom(existingTC);
        fixDoubleMarkers();
        if (state.editMode) setupInlineEditors();
        // state 동기화 (복사/다운로드용)
        const clone = existingTC.cloneNode(true);
        cleanEditingAttrs(clone);
        state.convertedHtml = clone.innerHTML;
      } else {
        // 초기 렌더 전이라 구조가 없으면 전체 갱신
        state.convertedHtml = newTC ? newTC.innerHTML : html;
        updatePreview();
      }
    }, 300);
  });
}

// ============================================
// 코드+뷰 분할 모드 위치 동기화 (코드↔미리보기 상호 이동)
// ============================================

function setupSplitViewPositionSync() {
  const cm = window._cmEditor;
  if (!cm) return;

  let syncLock = false;
  let highlightTimer = null;
  let codeToPreviewTimer = null;

  // 의미없는 태그 (컨테이너 구조 태그는 무시)
  const SKIP_TAGS = new Set(['html', 'head', 'body', 'style', 'script', 'meta', 'link', 'title', 'br', 'hr', 'img', 'span', 'a', 'strong', 'em', 'b', 'i', 'u', 's']);

  // 미리보기 요소 하이라이트 (노란 테두리 1.5초)
  function highlightPreviewEl(el) {
    if (!el) return;
    clearTimeout(highlightTimer);
    document.querySelectorAll('.sync-pos-highlight').forEach(e => e.classList.remove('sync-pos-highlight'));
    el.classList.add('sync-pos-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightTimer = setTimeout(() => el.classList.remove('sync-pos-highlight'), 1500);
  }

  // CodeMirror 특정 줄로 이동 + 배경 하이라이트
  function highlightCodeLine(line) {
    clearTimeout(highlightTimer);
    cm.scrollIntoView({ line, ch: 0 }, 100);
    cm.setCursor({ line, ch: 0 });
    // 기존 마커 제거
    cm.getAllMarks().forEach(m => { if (m._isSyncHighlight) m.clear(); });
    const marker = cm.markText(
      { line, ch: 0 },
      { line, ch: cm.getLine(line)?.length || 0 },
      { className: 'sync-code-highlight', _isSyncHighlight: true }
    );
    marker._isSyncHighlight = true;
    highlightTimer = setTimeout(() => { try { marker.clear(); } catch(e) {} }, 1500);
  }

  // 태그 열기 정규식 (tag 뒤에 공백 또는 > 만 허용 → <table_ext> 오매칭 방지)
  function openTagRe(tag) {
    return new RegExp(`<${tag}(?=[\\s>])[^>]*>`, 'gi');
  }

  // 코드 커서 위치에서 "현재 태그 + preview 인덱스" 계산 (스택 방식)
  function getTagAtCursor() {
    const cursor = cm.getCursor();
    const code = cm.getValue();
    const lines = code.split('\n');

    // 커서 위치까지의 문자 오프셋
    let offset = 0;
    for (let i = 0; i < cursor.line; i++) offset += lines[i].length + 1;
    offset += cursor.ch;
    const textUpToCursor = code.substring(0, offset);

    // 태그 스택으로 커서가 속한 가장 안쪽 요소 탐색
    const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)(?=[\s>\/])[^>]*>/g;
    const stack = [];  // { tag, openCount } — 열린 태그와 그 시점의 해당 태그 누적 수
    const openCounts = {};  // tag → 열린 태그 누적 수 (index 계산용)
    let m;
    while ((m = tagRe.exec(textUpToCursor)) !== null) {
      const full = m[0];
      const tag = m[1].toLowerCase();
      if (SKIP_TAGS.has(tag)) continue;
      if (full.startsWith('</')) {
        // 닫는 태그: 스택에서 같은 태그 제거
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === tag) { stack.splice(i, 1); break; }
        }
      } else if (!full.endsWith('/>')) {
        // 여는 태그
        openCounts[tag] = (openCounts[tag] || 0) + 1;
        stack.push({ tag, index: openCounts[tag] - 1 });
      }
    }

    // 스택 최상위 = 커서가 현재 속한 요소
    if (stack.length === 0) return null;
    const top = stack[stack.length - 1];
    return { tag: top.tag, index: top.index };
  }

  // preview DOM에서 tag + index로 요소 찾기
  function findPreviewEl(tag, index) {
    const preview = document.getElementById('preview-content');
    if (!preview) return null;
    return preview.querySelectorAll(tag)[index] || null;
  }

  // preview 요소 → 코드 줄 번호 계산
  function findCodeLineForEl(el) {
    const preview = document.getElementById('preview-content');
    if (!preview) return null;

    const tag = el.tagName.toLowerCase();
    const allEls = Array.from(preview.querySelectorAll(tag));
    const index = allEls.indexOf(el);
    if (index < 0) return null;

    const code = cm.getValue();
    const re = openTagRe(tag);
    let count = 0;
    let match;
    while ((match = re.exec(code)) !== null) {
      if (count === index) {
        const textBefore = code.substring(0, match.index);
        return textBefore.split('\n').length - 1;
      }
      count++;
    }
    return null;
  }

  // 코드 → 미리보기: 커서 이동 시 300ms 디바운스
  cm.on('cursorActivity', () => {
    if (syncLock || state.activeView !== 'split') return;
    clearTimeout(codeToPreviewTimer);
    codeToPreviewTimer = setTimeout(() => {
      const info = getTagAtCursor();
      if (!info) return;
      const el = findPreviewEl(info.tag, info.index);
      if (!el) return;
      syncLock = true;
      highlightPreviewEl(el);
      setTimeout(() => { syncLock = false; }, 300);
    }, 300);
  });

  // 미리보기 → 코드: 요소 클릭 시
  const preview = document.getElementById('preview-content');
  if (preview) {
    preview.addEventListener('click', (e) => {
      if (syncLock || state.activeView !== 'split') return;
      const el = e.target.closest('h1,h2,h3,h4,h5,h6,p,li,td,th,div,table,tr,ul,ol,section');
      if (!el || !preview.contains(el)) return;
      if (SKIP_TAGS.has(el.tagName.toLowerCase())) return;
      const line = findCodeLineForEl(el);
      if (line === null) return;
      syncLock = true;
      highlightCodeLine(line);
      setTimeout(() => { syncLock = false; }, 300);
    });
  }
}

// ============================================
// 패널별 Ctrl+A 전체선택 핸들러
// ============================================

// 요소 내 전체 선택 헬퍼 함수
function selectAllInElement(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// 패널별 Ctrl+A 전체선택 설정
function setupPanelSelectAll() {
  // 마지막으로 클릭한 패널 영역 추적
  let lastClickedPanel = null;

  // 각 패널 영역에 클릭 이벤트로 활성 패널 추적
  const sourceEditor = document.getElementById('source-editor');
  const templatePreview = document.getElementById('template-preview');
  const previewContent = document.getElementById('preview-content');

  if (sourceEditor) {
    sourceEditor.addEventListener('mousedown', () => { lastClickedPanel = 'source'; });
  }
  if (templatePreview) {
    templatePreview.addEventListener('mousedown', () => { lastClickedPanel = 'preview'; });
  }

  document.addEventListener('keydown', (e) => {
    // Ctrl+A 또는 Cmd+A (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      const target = e.target;

      // textarea, input은 기본 동작 유지
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        return; // 브라우저 기본값 사용
      }

      // contenteditable 요소 (원문 입력 영역)
      if (target.isContentEditable) {
        // contenteditable 내부에서는 해당 영역만 선택
        const editableRoot = target.closest('[contenteditable="true"]');
        if (editableRoot) {
          e.preventDefault();
          selectAllInElement(editableRoot);
          return;
        }
      }

      // 마지막으로 클릭한 패널 기준으로 선택
      if (lastClickedPanel === 'source' && sourceEditor) {
        e.preventDefault();
        selectAllInElement(sourceEditor);
        return;
      }

      if (lastClickedPanel === 'preview' && templatePreview) {
        e.preventDefault();
        // preview-content가 있으면 그 내용만 선택
        const content = previewContent || templatePreview;
        selectAllInElement(content);
        return;
      }
    }
  });
}

function updateHtmlCode() {
  const fullHtml = generateFullHtml();
  elements.htmlCode.value = fullHtml;
}

// ============================================
// HTML 포맷팅 (가독성 개선)
// ============================================

function formatHtml(html, indentSize = 2) {
  // 블록 레벨 태그 (줄바꿈 및 들여쓰기 적용)
  const blockTags = [
    'html', 'head', 'body', 'div', 'section', 'article', 'header', 'footer', 'nav', 'aside', 'main',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'form', 'fieldset', 'legend', 'label', 'input', 'textarea', 'select', 'option', 'button',
    'meta', 'title', 'link', 'style', 'script'
  ];

  // 자기 닫힘 태그 (닫는 태그 없음)
  const selfClosingTags = ['meta', 'link', 'br', 'hr', 'img', 'input'];

  let result = '';
  let indentLevel = 0;
  const indent = ' '.repeat(indentSize);

  // HTML을 토큰으로 분리 (태그와 텍스트)
  const tokens = html.split(/(<[^>]+>)/g).filter(token => token.trim() !== '');

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (!token) continue;

    // 태그인지 확인
    if (token.startsWith('<')) {
      // 주석인 경우
      if (token.startsWith('<!--')) {
        result += indent.repeat(indentLevel) + token + '\n';
        continue;
      }

      // 닫는 태그인지 확인
      const isClosingTag = token.startsWith('</');

      // 태그 이름 추출
      const tagMatch = token.match(/<\/?([a-zA-Z0-9]+)/);
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';

      const isBlockTag = blockTags.includes(tagName);
      const isSelfClosing = selfClosingTags.includes(tagName) || token.endsWith('/>');

      if (isClosingTag && isBlockTag) {
        // 닫는 블록 태그: 들여쓰기 감소 후 출력
        indentLevel = Math.max(0, indentLevel - 1);
        result += indent.repeat(indentLevel) + token + '\n';
      } else if (isBlockTag && !isSelfClosing) {
        // 여는 블록 태그: 현재 들여쓰기로 출력 후 증가
        result += indent.repeat(indentLevel) + token + '\n';
        indentLevel++;
      } else if (isSelfClosing || (isBlockTag && isSelfClosing)) {
        // 자기 닫힘 태그: 현재 들여쓰기로 출력
        result += indent.repeat(indentLevel) + token + '\n';
      } else {
        // 인라인 태그: 줄바꿈 없이 추가
        result += token;
      }
    } else {
      // 텍스트 노드: 앞뒤 공백 정리 후 추가
      const text = token.trim();
      if (text) {
        // 이전 토큰이 블록 태그였으면 들여쓰기 추가
        const lastChar = result.slice(-1);
        if (lastChar === '\n') {
          result += indent.repeat(indentLevel) + text;
        } else {
          result += text;
        }
      }
    }
  }

  // 연속 줄바꿈 정리
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

function applyEditedHtml() {
  const raw = elements.htmlCode.value;

  // <body>…</body> 사이의 콘텐츠 추출
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1].trim() : raw.trim();

  // 인크루트 포맷(templwrap_v3 / templ_content) 이미 포함된 경우 — 내부 콘텐츠만 추출
  if (isIncruitFormattedHtml(content)) {
    content = extractInnerJobContent(content);
  }

  state.convertedHtml = content;
  updatePreview();
}

// ============================================
// HTML 가져오기 (Import) 기능
// ============================================

/**
 * 완성된 HTML 문서인지 간이 감지
 */
function isCompletedHtml(html) {
  const t = html.trim();
  return (
    /<!DOCTYPE\s+html/i.test(t) ||
    /^<html[\s>]/i.test(t) ||
    /id=["']?templwrap_v3/i.test(t) ||
    /class=["'][^"']*tempNew-wrap/i.test(t) ||
    /id=["']?isIncruit/i.test(t)
  );
}

/**
 * 가져온 HTML의 유형을 감지
 * @returns {{ type: string, template: string|null, colors: Object, sections: Array, hasKv: boolean }}
 */
function detectImportedHtmlType(html) {
  const result = {
    type: 'unknown',
    template: null,
    colors: { primary: null, secondary: null, thBg: null, thText: null },
    sections: [],
    hasKv: false
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // 1. 인크루트 v3 (#templwrap_v3)
  const templwrap = doc.querySelector('#templwrap_v3');
  if (templwrap) {
    result.type = 'incruit_v3';
    result.template = 'standard';
    const templHeader = templwrap.querySelector('.templ_header');
    if (templHeader) {
      result.hasKv = !!templHeader.querySelector('img.top_img_v2, .kv-card');
    }
    templwrap.querySelectorAll('.sec_wrap').forEach(sec => {
      const titleEl = sec.querySelector('.sec_title h3');
      const contentEl = sec.querySelector('.sec_box');
      if (titleEl) {
        result.sections.push({
          title: titleEl.textContent.trim(),
          content: contentEl ? contentEl.innerHTML : ''
        });
      }
    });
    extractColorsFromImportedDoc(doc, result.colors);
    return result;
  }

  // 2. 인크루트 New (.tempNew-wrap)
  const tempNew = doc.querySelector('.tempNew-wrap');
  if (tempNew) {
    result.type = 'incruit_new';
    const tplMap = {
      'tpl-it01': 'incruit_it', 'tpl-startup02': 'incruit_startup',
      'tpl-startup01': 'incruit_mint', 'tpl-business04': 'incruit_biz',
      'tpl-default': 'incruit_classic', 'tpl-tempNew03': 'incruit_news'
    };
    const classes = Array.from(tempNew.classList);
    const tplClass = classes.find(c => c.startsWith('tpl-'));
    if (tplClass) result.template = tplMap[tplClass] || null;

    const style = tempNew.getAttribute('style') || '';
    const accentMatch = style.match(/--tpl-accent:\s*([^;]+)/);
    if (accentMatch) result.colors.primary = accentMatch[1].trim();

    const jobContent = tempNew.querySelector('.job-content');
    if (jobContent) result.sections.push({ title: '', content: jobContent.innerHTML });
    return result;
  }

  // 3. data-hr-property / #isIncruit
  if (doc.querySelector('[data-hr-property], [data-incruit-field], #isIncruit[value="Y"]')) {
    result.type = 'incruit_legacy';
    result.sections = detectSectionsFromHtml(doc.body.innerHTML);
    extractColorsFromImportedDoc(doc, result.colors);
    return result;
  }

  // 4. 일반 HTML
  if (/<(?:h[1-6]|table|div|p|ul|ol)\b/i.test(html)) {
    result.type = 'general_html';
    result.sections = detectSectionsFromHtml(doc.body.innerHTML);
    return result;
  }

  result.type = 'plain_text';
  return result;
}

/**
 * HTML 문서에서 인크루트 팔레트 색상 추출
 */
function extractColorsFromImportedDoc(doc, colors) {
  doc.querySelectorAll('style').forEach(style => {
    const css = style.textContent;
    const iconMatch = css.match(/\.sec_title_icon\s+span\s*\{[^}]*background:\s*([#\w]+)/);
    if (iconMatch) colors.primary = iconMatch[1];
    const thBgMatch = css.match(/\.bTable_1\s+th\s*\{[^}]*background:\s*([#\w]+)/);
    if (thBgMatch) colors.thBg = thBgMatch[1];
    const thColorMatch = css.match(/\.bTable_1\s+th\s*\{[^}]*?(?:;\s*)?color:\s*([#\w]+)/);
    if (thColorMatch) colors.thText = thColorMatch[1];
  });

  if (!colors.primary) {
    const iconSpan = doc.querySelector('.sec_title_icon span');
    if (iconSpan) {
      const bg = iconSpan.style.background || iconSpan.style.backgroundColor;
      if (bg) colors.primary = bg;
    }
  }
}

/**
 * 가져온 HTML에서 순수 콘텐츠 추출 (래퍼 제거)
 */
function extractContentFromImportedHtml(html, detected) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  switch (detected.type) {
    case 'incruit_v3': {
      const templContent = doc.querySelector('#templwrap_v3 .templ_content');
      if (!templContent) return doc.body.innerHTML;
      const parts = [];
      templContent.querySelectorAll('.sec_wrap').forEach(sec => {
        const titleEl = sec.querySelector('.sec_title h3');
        const contentEl = sec.querySelector('.sec_box');
        if (titleEl) parts.push(`<h2>${titleEl.innerHTML}</h2>`);
        if (contentEl) {
          let content = contentEl.innerHTML;
          content = content.replace(/<div class="table_x">([\s\S]*?)<\/div>/gi, '$1');
          parts.push(content);
        }
      });
      return parts.join('\n');
    }
    case 'incruit_new': {
      const jobContent = doc.querySelector('.job-content');
      return jobContent ? jobContent.innerHTML : doc.body.innerHTML;
    }
    case 'incruit_legacy': {
      doc.querySelectorAll('#isIncruit, link[href*="incru.it"], style').forEach(el => el.remove());
      return doc.body.innerHTML;
    }
    case 'general_html': {
      doc.querySelectorAll('script, meta, link').forEach(el => el.remove());
      return doc.body.innerHTML;
    }
    default:
      return html;
  }
}

// --- 모달 제어 ---

function openImportModal(prefillHtml) {
  const modal = document.getElementById('html-import-modal');
  const textarea = document.getElementById('import-html-textarea');
  modal.classList.remove('hidden');
  textarea.value = prefillHtml || '';
  // 리셋
  document.getElementById('import-detect-result').classList.add('hidden');
  document.getElementById('import-options').classList.add('hidden');
  document.getElementById('import-color-extract').classList.add('hidden');
  document.getElementById('btn-import-confirm').disabled = true;
  // 기존 감지 데이터 초기화
  modal._detected = null;

  if (prefillHtml) analyzeImportedHtml(prefillHtml);
}

function closeImportModal() {
  const modal = document.getElementById('html-import-modal');
  modal.classList.add('hidden');
  document.getElementById('import-html-textarea').value = '';
  modal._detected = null;
}

/**
 * textarea 내용을 분석하여 감지 결과 UI 업데이트
 */
function analyzeImportedHtml(html) {
  const confirmBtn = document.getElementById('btn-import-confirm');
  if (!html || !html.trim()) {
    document.getElementById('import-detect-result').classList.add('hidden');
    document.getElementById('import-options').classList.add('hidden');
    document.getElementById('import-color-extract').classList.add('hidden');
    confirmBtn.disabled = true;
    return;
  }

  const detected = detectImportedHtmlType(html);
  const modal = document.getElementById('html-import-modal');
  modal._detected = detected;

  // 감지 결과 표시
  const resultEl = document.getElementById('import-detect-result');
  resultEl.classList.remove('hidden');

  const typeLabels = {
    'incruit_v3': { icon: '\u{1F7E2}', label: '\uc778\ud06c\ub8e8\ud2b8 v3 \ud45c\uc900 \ud15c\ud50c\ub9bf' },
    'incruit_new': { icon: '\u{1F7E2}', label: '\uc778\ud06c\ub8e8\ud2b8 New \ud15c\ud50c\ub9bf' },
    'incruit_legacy': { icon: '\u{1F7E1}', label: '\uc778\ud06c\ub8e8\ud2b8 \ud615\uc2dd HTML' },
    'general_html': { icon: '\u{1F535}', label: '\uc77c\ubc18 HTML' },
    'plain_text': { icon: '\u26AA', label: '\ud50c\ub808\uc778 \ud14d\uc2a4\ud2b8' }
  };

  const typeInfo = typeLabels[detected.type] || { icon: '\u26AA', label: '\uc54c \uc218 \uc5c6\ub294 \ud615\uc2dd' };
  document.getElementById('import-detect-icon').textContent = typeInfo.icon;
  document.getElementById('import-detect-label').textContent = typeInfo.label;

  const details = [];
  if (detected.template && templates[detected.template]) {
    details.push('\ud15c\ud50c\ub9bf: ' + templates[detected.template].name);
  }
  if (detected.sections.length) details.push('\uc139\uc158: ' + detected.sections.length + '\uac1c');
  if (detected.hasKv) details.push('\ud0a4\ube44\uc8fc\uc5bc \uc788\uc74c');
  if (detected.colors.primary) details.push('Primary \uc0c9\uc0c1: ' + detected.colors.primary);
  document.getElementById('import-detect-details').innerHTML = details.map(d => '<div>' + d + '</div>').join('');

  // 옵션 표시
  document.getElementById('import-options').classList.remove('hidden');
  confirmBtn.disabled = false;

  // 색상 추출 결과
  const hasColors = detected.colors.primary || detected.colors.thBg;
  const colorEl = document.getElementById('import-color-extract');
  if (hasColors) {
    colorEl.classList.remove('hidden');
    const swatches = document.getElementById('import-detected-colors');
    swatches.innerHTML = '';
    for (const [key, val] of Object.entries(detected.colors)) {
      if (val) {
        const swatch = document.createElement('div');
        swatch.className = 'import-color-swatch';
        swatch.style.background = val;
        swatch.title = key + ': ' + val;
        swatches.appendChild(swatch);
      }
    }
  } else {
    colorEl.classList.add('hidden');
  }
}

// --- 가져오기 모드 처리 ---

/**
 * 감지된 색상을 UI 팔레트에 적용
 */
function applyDetectedColors(colors) {
  if (colors.primary) {
    state.colorPrimary = colors.primary;
    const swatch = document.getElementById('color-primary');
    const hex = document.getElementById('color-primary-hex');
    if (swatch) swatch.value = colors.primary;
    if (hex) hex.value = colors.primary.toUpperCase();
  }
  if (colors.thBg) {
    state.thColor = colors.thBg;
    const swatch = document.getElementById('th-color');
    const hex = document.getElementById('th-color-hex');
    if (swatch) swatch.value = colors.thBg;
    if (hex) hex.value = colors.thBg.toUpperCase();
  }
  if (colors.thText) {
    state.thTextColor = colors.thText;
    const swatch = document.getElementById('th-text-color');
    const hex = document.getElementById('th-text-color-hex');
    if (swatch) swatch.value = colors.thText;
    if (hex) hex.value = colors.thText.toUpperCase();
  }
  updateCssVariables();
}

/**
 * 모드 1: 코드 직접 편집
 */
function importAsDirect(html, detected) {
  elements.htmlCode.value = html;
  // body 추출 없이 직접 설정
  state.convertedHtml = html.trim();
  updatePreview();

  saveOriginalSource('html', html, {
    importMode: 'direct',
    detectedType: detected.type,
    importedAt: new Date().toISOString()
  });

  setViewAndActivateTab('code');
  addMessage('assistant', 'HTML \ucf54\ub4dc\ub97c \uac00\uc838\uc654\uc2b5\ub2c8\ub2e4. \ucf54\ub4dc \ud0ed\uc5d0\uc11c \uc9c1\uc811 \ud3b8\uc9d1\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.');
}

/**
 * 모드 2: 콘텐츠 추출 후 템플릿 재적용
 */
function importAsExtractRewrap(html, detected) {
  const content = extractContentFromImportedHtml(html, detected);
  state.convertedHtml = content;
  safeSetHtml(elements.sourceEditor, content);
  state.sourceContent = content;

  saveOriginalSource('html', html, {
    importMode: 'extract-rewrap',
    detectedType: detected.type,
    importedAt: new Date().toISOString()
  });

  updatePreview();
  setViewAndActivateTab('preview');
  const sectionCount = detected.sections.length;
  addMessage('assistant', 'HTML\uc5d0\uc11c \ucf58\ud150\uce20\ub97c \ucd94\ucd9c\ud558\uc5ec ' + templates[state.template].name + ' \ud15c\ud50c\ub9bf\uc73c\ub85c \uc7ac\uc801\uc6a9\ud588\uc2b5\ub2c8\ub2e4. (' + sectionCount + '\uac1c \uc139\uc158)');
}

/**
 * 모드 3: 원문으로 사용 (기존 변환 흐름)
 */
function importAsSource(html, detected) {
  processInputSource(html, {
    type: 'html',
    importMode: 'as-source',
    detectedType: detected.type,
    importedAt: new Date().toISOString()
  });
  addMessage('assistant', 'HTML\uc744 \uc6d0\ubb38\uc73c\ub85c \uac00\uc838\uc654\uc2b5\ub2c8\ub2e4. "\ube60\ub978 \ubcc0\ud658" \ub610\ub294 "AI \ubcc0\ud658" \ubc84\ud2bc\uc73c\ub85c \ubcc0\ud658\ud558\uc138\uc694.');
}

/**
 * HTML 가져오기 확인 버튼 핸들러
 */
function handleImportHtml() {
  const textarea = document.getElementById('import-html-textarea');
  const html = textarea.value.trim();
  if (!html) return;

  const modal = document.getElementById('html-import-modal');
  const detected = modal._detected || detectImportedHtmlType(html);
  const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'direct';
  const applyColors = document.getElementById('import-apply-colors')?.checked;

  if (applyColors && (detected.colors.primary || detected.colors.thBg)) {
    applyDetectedColors(detected.colors);
  }

  switch (mode) {
    case 'direct': importAsDirect(html, detected); break;
    case 'extract-rewrap': importAsExtractRewrap(html, detected); break;
    case 'as-source': importAsSource(html, detected); break;
  }

  closeImportModal();
  saveSession();
}

/**
 * 소스 에디터에 완성 HTML 붙여넣기 시 안내 배너 표시
 */
function showImportSuggestion(html) {
  // 기존 배너 제거
  document.querySelector('.import-suggestion-banner')?.remove();

  const banner = document.createElement('div');
  banner.className = 'import-suggestion-banner';
  banner.innerHTML = '<div>\uc644\uc131\ub41c HTML \ucf54\ub4dc\uac00 \uac10\uc9c0\ub418\uc5c8\uc2b5\ub2c8\ub2e4.</div>' +
    '<div class="flex gap-2 mt-2">' +
    '<button class="import-suggest-btn primary" id="suggest-import">HTML \uac00\uc838\uc624\uae30\ub85c \uc5f4\uae30</button>' +
    '<button class="import-suggest-btn" id="suggest-paste-anyway">\uadf8\ub0e5 \uc6d0\ubb38\uc73c\ub85c \ubd99\uc5ec\ub123\uae30</button>' +
    '</div>';

  const sourceContainer = elements.sourceEditor?.parentElement;
  if (sourceContainer) {
    sourceContainer.style.position = 'relative';
    sourceContainer.prepend(banner);
  }

  document.getElementById('suggest-import').addEventListener('click', () => {
    banner.remove();
    openImportModal(html);
  });

  document.getElementById('suggest-paste-anyway').addEventListener('click', () => {
    banner.remove();
    const cleaned = cleanHtml(html);
    safeSetHtml(elements.sourceEditor, cleaned);
    processInputSource(cleaned, { type: 'paste', pastedAt: new Date().toISOString() });
  });
}

// ============================================
// 인크루트 표준 형식 헬퍼 함수들
// ============================================

/**
 * HTML 콘텐츠에서 섹션 감지 (h2 태그 기준)
 * @param {string} html - 변환된 HTML
 * @returns {Array<{title: string, content: string}>} 섹션 배열
 */
function detectSectionsFromHtml(html) {
  if (!html || !html.trim()) return [];

  const container = document.createElement('div');
  container.innerHTML = html;

  const sections = [];
  let currentSection = null;
  let beforeFirstH2 = [];

  // 모든 자식 노드 순회
  const nodes = Array.from(container.childNodes);

  for (const node of nodes) {
    // h2 태그 발견 시 새 섹션 시작
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'H2') {
      // 이전 섹션 저장
      if (currentSection) {
        sections.push(currentSection);
      }
      // 새 섹션 시작
      currentSection = {
        title: node.textContent.trim(),
        content: ''
      };
    } else {
      // h2가 아닌 요소
      const nodeHtml = node.nodeType === Node.ELEMENT_NODE
        ? node.outerHTML
        : (node.nodeType === Node.TEXT_NODE ? node.textContent : '');

      if (currentSection) {
        currentSection.content += nodeHtml;
      } else {
        // 첫 h2 이전 콘텐츠
        beforeFirstH2.push(nodeHtml);
      }
    }
  }

  // 마지막 섹션 저장
  if (currentSection) {
    sections.push(currentSection);
  }

  // 첫 h2 이전 콘텐츠가 있으면 "개요" 섹션으로 추가
  if (beforeFirstH2.length > 0) {
    const introContent = beforeFirstH2.join('').trim();
    if (introContent && !introContent.match(/^[\s]*$/)) {
      sections.unshift({
        title: '채용개요',
        content: introContent
      });
    }
  }

  return sections;
}

/**
 * titleSub (c_title_1~8) 커스텀 CSS 생성
 */
function buildTitleSubStyles() {
  let css = '';
  if (state.titleSub === '1') {
    css += `#templwrap_v3 .c_title_1 h3 { border-bottom: 3px solid ${state.subTitleLineColor} !important; color: ${state.subTitleTextColor} !important; padding: 0 10px 5px 10px; display: inline-block; }`;
  } else if (state.titleSub === '2') {
    css += `#templwrap_v3 .c_title_2 h3 { background: ${state.subTitleBgColor} !important; color: ${state.subTitleTextColor} !important; border-top: solid 1px ${state.subTitleLineColor} !important; border-bottom: solid 1px ${state.subTitleLineColor} !important; padding: 0 10px; display: block; }`;
  } else if (state.titleSub === '3') {
    css += `#templwrap_v3 .c_title_3 h3 { padding: 0 10px; border: 1px solid ${state.subTitleLineColor} !important; color: ${state.subTitleTextColor} !important; box-shadow: 4px 4px 0 ${state.subTitleShadowColor} !important; display: inline-block; }`;
  } else if (state.titleSub === '4') {
    css += `#templwrap_v3 .c_title_4 h3 .title_num { background: ${state.subTitleBgColor} !important; color: ${state.subTitleTextColor} !important; display: inline-block; padding: 0 14px 0 12px; margin-right: 10px; }`;
  } else if (state.titleSub === '5') {
    css += `#templwrap_v3 .c_title_5 h3 { background: ${state.subTitleBgColor} !important; padding: 0 30px 0 10px; position: relative; color: ${state.subTitleTextColor} !important; display: inline-block; line-height: 40px; }`;
    css += `#templwrap_v3 .c_title_5 h3:before { content: ""; position: absolute; right: -14px; top: 6px; height: 28px; width: 28px; background: ${state.subTitleBgColor} !important; transform: rotate(-45deg); z-index: 1; }`;
  } else if (state.titleSub === '6') {
    css += `#templwrap_v3 .c_title_6 h3 { border-bottom-color: ${state.subTitleLineColor} !important; }`;
    css += `#templwrap_v3 .c_title_6 h3 .title_num { background: ${state.subTitleBgColor} !important; }`;
    css += `#templwrap_v3 .c_title_6 h3 .title_num:after { border-right-color: ${state.subTitleLineColor} !important; border-left-color: ${state.subTitleBgColor} !important; }`;
  } else if (state.titleSub === '7') {
    css += `#templwrap_v3 .c_title_7 h3:before { background: ${state.subTitleBgColor} !important; }`;
  } else if (state.titleSub === '8') {
    css += `#templwrap_v3 .c_title_8 h3 { background: ${state.subTitleBgColor} !important; }`;
    css += `#templwrap_v3 .c_title_8 h3:before { background: ${state.subTitleLineColor} !important; }`;
  }
  return css;
}

/**
 * 인크루트 최종 HTML용 동적 CSS 생성
 * 타이틀 스타일 + 테이블 헤더 색상 포함
 */
function buildIncruitDynamicStyles() {
  let css = '';

  // 헤더 텍스트 CSS 생성 헬퍼
  function headerTextCss(selector, style, align, defaultTop) {
    const fontSize   = style.fontSize || 14;
    const fontWeight = style.bold ? '700' : '400';
    const color      = style.color || '#333333';
    const textAlign  = align || 'left';
    const top = style.top ?? defaultTop;
    return `#templwrap_v3 .templ_header ${selector} { padding: 0 4.444%; font-size: ${fontSize}px; font-weight: ${fontWeight}; color: ${color}; text-align: ${textAlign}; position: absolute; top: ${top}%; left: 0; right: 0; margin: 0; line-height: 1.5; }`;
  }

  // KV OFF일 때만 비KV 헤더 텍스트 CSS 출력
  if (!state.kvEnabled) {
    const hasHeaderText = state.jobNumber || state.headerCompanyName || state.headerDate;
    if (hasHeaderText) {
      css += `#templwrap_v3 .templ_header { padding: 0; position: relative; line-height: 0; }`;
    }
    if (state.jobNumber)         css += headerTextCss('.templ_num',     state.jobNumberStyle,   state.jobNumberAlign,   10);
    if (state.headerCompanyName) css += headerTextCss('.templ_company', state.companyNameStyle, state.companyNameAlign, 5);
    if (state.headerDate)        css += headerTextCss('.templ_date',    state.headerDateStyle,  state.headerDateAlign,  5);
  }

  // 하단 버튼 기본 CSS (항상 출력)
  css += `#templwrap_v3 .templ-bottom-btn { text-align: center; padding: 0 4.444%; }`;

  if (state.bottomButtons && state.bottomButtons.length > 0) {
    // 기본 구조 CSS (먼저 출력)
    css += `#templwrap_v3 .templ-bottom-btn a { display: inline-block; margin: 0 4px 8px; text-decoration: none; }`;
    css += `#templwrap_v3 .temp_btn { display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #fff; border-radius: 4px; cursor: pointer; text-decoration: none; transition: all 0.2s; }`;
    css += `#templwrap_v3 .temp_btn.radius10 { border-radius: 10px; }`;
    css += `#templwrap_v3 .temp_btn.btn2 { border: 2px solid; }`;
    css += `#templwrap_v3 .temp_btn.btn3 { border: 2px solid; }`;
    css += `#templwrap_v3 .temp_btn.btn4 { border: 2px solid; }`;
    css += `#templwrap_v3 .temp_btn.btn5 { border: 2px solid; }`;
    css += `#templwrap_v3 .temp_btn.btn6 { border-radius: 50px; }`;
    css += `#templwrap_v3 .temp_btn.btn8 { border-radius: 50px; border: 2px solid; background: transparent; }`;
    css += `#templwrap_v3 .temp_btn.btn_a1 { transition: background 0.2s; }`;
    css += `#templwrap_v3 .temp_btn.btn_a2 { transition: opacity 0.2s; }`;
    css += `#templwrap_v3 .temp_btn.btn_a2:hover { opacity: 0.8; }`;
    css += `#templwrap_v3 .temp_btn.btn_a3 { position: relative; top: 0; transition: all 0.15s; }`;
    css += `#templwrap_v3 .temp_btn.btn_a3:hover { top: 3px; }`;
    css += `#templwrap_v3 .temp_btn.btn_a4 { transition: filter 0.2s; }`;
    css += `#templwrap_v3 .temp_btn.btn_a4:hover { filter: brightness(1.15); }`;
    css += `#templwrap_v3 .temp_btn.btn_a5 { transition: padding 0.2s; }`;
    css += `#templwrap_v3 .temp_btn.btn_a5:hover { padding-right: 42px; }`;
    css += `#templwrap_v3 .temp_btn.btn_a6 { overflow: hidden; position: relative; transition: color 0.3s; }`;
    css += `#templwrap_v3 .h40 { height: 40px; }`;
    // 색상 CSS (기본 구조 CSS 이후에 출력 → 우선순위 보장)
    state.bottomButtons.forEach((btn, idx) => {
      css += buildBtnColorCss(btn, idx);
    });
  }

  // 테이블 헤더 색상
  css += `#templwrap_v3 .bTable_1 th { background: ${state.thColor} !important; color: ${state.thTextColor} !important; }`;
  css += `#templwrap_v3 .bTable_1 td { border-color: #e5e5e5; }`;

  // 타이틀 스타일별 CSS
  if (state.titleStyle === 'iconNumber' || state.titleStyle === 'iconBg') {
    css += `#templwrap_v3 .sec_title_icon span { background-color: ${state.colorPrimary} !important; display: block !important; }`;
  }

  if (state.titleStyle === 'titleSub') {
    css += buildTitleSubStyles();
  }

  // ★ CSS minify (공백, 주석 제거)
  return minifyCSS(css);
}

/**
 * ★ CSS minify — 공백, 줄 바꿈, 주석 제거
 */
function minifyCSS(css) {
  if (!css) return css;
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')  // 주석 제거
    .replace(/\s+/g, ' ')               // 연속 공백 → 단일 공백
    .replace(/\s*([{}:;,])\s*/g, '$1')  // 선택자/속성 주변 공백 제거
    .trim();
}

/**
 * 테이블에 인크루트 표준 클래스 적용 (DOM 기반, 미리보기용)
 * @param {HTMLElement} container - 대상 컨테이너
 */
function applyIncruitTableClassesToDom(container) {
  if (!container) return;
  const tables = container.querySelectorAll('table');
  tables.forEach(table => {
    table.setAttribute('width', '100%');
    table.setAttribute('border', '1');
    const isNested = !!table.closest('td, th');
    if (isNested) {
      // 중첩 테이블: stable fs15 필수 (이미 table_type이 있어도 추가)
      table.classList.add('table_type', 'bTable_1', 'stable', 'fs15');
    } else {
      // 이미 처리된 바깥 테이블 스킵
      if (table.classList.contains('table_type')) return;
      table.classList.add('table_type', 'bTable_1');
    }

    // .table_x 래퍼 추가 (이미 래핑된 경우 스킵)
    if (!table.parentElement || !table.parentElement.classList.contains('table_x')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'table_x';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  });

  // 2차 패스: td/th 직접 선택자로 중첩 테이블 stable fs15 확정 보장
  // (.table_x 래퍼 삽입 후 closest() 감지가 누락되는 케이스 보완)
  container.querySelectorAll('td table, th table').forEach(table => {
    table.classList.add('stable', 'fs15');
  });

  // 3차 패스: 모든 ul/ol에 인크루트 리스트 클래스 자동 부여 (블릿 보장)
  // - <ul> → ulist (블릿 표시)
  // - <ol> → olist olnum (번호 표시)
  // 텍스트가 "※"로 시작하는 li가 있는 ul → noti 추가
  container.querySelectorAll('ul').forEach(ul => {
    const cls = ul.classList;
    if (!cls.contains('ulist') && !cls.contains('noti')) {
      cls.add('ulist');
    }
    // ※ 주석 ul 자동 감지
    const firstLi = ul.querySelector(':scope > li');
    if (firstLi && /^\s*[※\u203B]/.test(firstLi.textContent) && !cls.contains('noti')) {
      cls.add('noti');
    }
  });
  container.querySelectorAll('ol').forEach(ol => {
    const cls = ol.classList;
    // 한글 마커(가. 나. 다.)면 kolist, 숫자면 olnum — 과반수 기준
    const lis = ol.querySelectorAll(':scope > li');
    const koCount = Array.from(lis).filter(li =>
      /^[가-힣][.)]\s/.test((li.textContent || '').trimStart())
    ).length;
    const isKo = lis.length > 0 && koCount > lis.length / 2;
    if (!cls.contains('olist')) cls.add('olist');
    if (isKo && !cls.contains('kolist')) cls.add('kolist');
    else if (!isKo && !cls.contains('olnum') && !cls.contains('kolist')) cls.add('olnum');
  });

  // 4차 패스: 전형절차 테이블 화살표 셀 스타일 처리
  // → ▶ ▷ ➔ 등 화살표만 있는 셀의 상하 border 제거 + th 배경 제거
  const ARROW_ONLY_RE = /^[→▶▷➔➜►▻>›]$/;
  container.querySelectorAll('td, th').forEach(cell => {
    const text = cell.textContent.trim();
    const hasOnlyImg = !text && cell.querySelector('img') && !cell.querySelector('table, ul, ol, p');
    const isArrow = ARROW_ONLY_RE.test(text) || hasOnlyImg;

    if (isArrow) {
      // 이미지만 있는 셀: 이미지 제거 후 → 텍스트 삽입
      if (hasOnlyImg) {
        cell.innerHTML = '→';
      }
      // th → td 변환 (화살표 셀에 th 스타일 불필요)
      let target = cell;
      if (cell.tagName === 'TH') {
        const td = document.createElement('td');
        td.innerHTML = cell.innerHTML;
        for (const attr of cell.attributes) td.setAttribute(attr.name, attr.value);
        cell.replaceWith(td);
        target = td;
      }
      target.style.borderTop = '0';
      target.style.borderBottom = '0';
      target.style.background = 'none';
      target.style.textAlign = 'center';
      target.style.verticalAlign = 'middle';
    }
  });
}

/**
 * 테이블에 인크루트 표준 클래스 적용
 * @param {string} html - HTML 콘텐츠
 * @returns {string} 클래스가 적용된 HTML
 */
function applyIncruitTableClasses(html) {
  if (!html) return html;

  // DOM 기반으로 처리 (regex+인덱스 대조 방식 제거)
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;

  // 1차 패스: 테이블 클래스 + table_x 래퍼
  const tables = root.querySelectorAll('table');
  tables.forEach(table => {
    table.setAttribute('width', '100%');
    table.setAttribute('border', '1');
    const isNested = !!table.closest('td, th');
    if (isNested) {
      table.classList.add('table_type', 'bTable_1', 'stable', 'fs15');
    } else {
      if (table.classList.contains('table_type')) return;
      table.classList.add('table_type', 'bTable_1');
    }

    // .table_x 래퍼 추가 (이미 래핑된 경우 스킵)
    if (!table.parentElement || !table.parentElement.classList.contains('table_x')) {
      const wrapper = doc.createElement('div');
      wrapper.className = 'table_x';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  });

  // 2차 패스: td/th 안의 중첩 테이블에 stable fs15 확정 보장
  root.querySelectorAll('td table, th table').forEach(table => {
    table.classList.add('stable', 'fs15');
  });

  // 3차 패스: ul/ol 리스트 클래스 부여
  root.querySelectorAll('ul').forEach(ul => {
    const cls = ul.classList;
    if (!cls.contains('ulist') && !cls.contains('noti')) {
      cls.add('ulist');
    }
    const firstLi = ul.querySelector(':scope > li');
    if (firstLi && /^\s*[※\u203B]/.test(firstLi.textContent) && !cls.contains('noti')) {
      cls.add('noti');
    }
  });
  root.querySelectorAll('ol').forEach(ol => {
    const cls = ol.classList;
    // 한글 마커(가. 나. 다.)면 kolist, 숫자면 olnum — 과반수 기준
    const lis = ol.querySelectorAll(':scope > li');
    const koCount = Array.from(lis).filter(li =>
      /^[가-힣][.)]\s/.test((li.textContent || '').trimStart())
    ).length;
    const isKo = lis.length > 0 && koCount > lis.length / 2;
    if (!cls.contains('olist')) cls.add('olist');
    if (isKo && !cls.contains('kolist')) cls.add('kolist');
    else if (!isKo && !cls.contains('olnum') && !cls.contains('kolist')) cls.add('olnum');
  });

  return root.innerHTML;
}

/**
 * 섹션을 인크루트 표준 구조로 래핑
 * @param {Object} section - {title, content}
 * @param {number} index - 섹션 인덱스 (1부터 시작)
 * @param {string} primaryColor - 주 색상
 * @returns {string} 래핑된 HTML
 */
function wrapInSectionStructure(section, index, primaryColor) {
  const secNum = index + 1;
  const content = applyIncruitTableClasses(section.content);
  const titleInfo = buildSectionTitleHtml(section.title, secNum);

  return `
    <div class="sec_wrap sec${secNum}">
      <div class="${titleInfo.titleWrapClass}">
        ${titleInfo.innerHTML}
      </div>
      <div class="sec_box">
        ${content}
      </div>
    </div>
    <div class="h40"></div>`;
}

/**
 * 인크루트 표준 형식의 전체 HTML 생성
 */
function getCacheBuster() {
  const d = new Date();
  return [
    String(d.getFullYear()).slice(-2),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join('');
}

function generateFullHtml() {
  // pass_fail 템플릿: templ_header(KV/top_img) + templ_content 구조로 빌드
  if (state.template === 'pass_fail') {
    const dynamicCss = buildIncruitDynamicStyles();

    // templ_header 내부 HTML: KV ON → kv-card, KV OFF → top_img_v2 + 헤더 텍스트
    let headerInnerHtml = '';
    if (state.kvEnabled) {
      const kvCard = document.getElementById('kv-preview-card');
      if (kvCard) {
        const kvClone = kvCard.cloneNode(true);
        cleanEditingAttrs(kvClone);
        headerInnerHtml = kvClone.outerHTML;
      }
    } else {
      const topImgUrl = state.keyVisualUrl || state.kv?.bgImageUrl || '';
      const companyName = state.kv.companyName && state.kv.companyName !== '기업명' ? state.kv.companyName : '채용공고';
      if (topImgUrl) {
        headerInnerHtml = `<img src="${topImgUrl}" class="top_img_v2" alt="${companyName} 키비주얼">`;
      }
      // 채용공고 번호/기업명/날짜 헤더 텍스트 (standard 템플릿과 동일 방식)
      const buildHdrEl = (text, style, align, cls) => {
        if (!text) return '';
        const top = style?.top ?? 10;
        const fs  = style?.fontSize || 14;
        const col = style?.color || '#333333';
        const fw  = style?.bold ? '700' : '400';
        const ta  = align || 'left';
        return `      <p class="${cls}" style="position:absolute;top:${top}%;left:0;right:0;padding:0 4.444%;line-height:1.5;margin:0;text-align:${ta};font-size:${fs}px;color:${col};font-weight:${fw}">${text}</p>`;
      };
      const headerTextHtml = [
        buildHdrEl(state.jobNumber,         state.jobNumberStyle,   state.jobNumberAlign,   'templ_num'),
        buildHdrEl(state.headerCompanyName, state.companyNameStyle, state.companyNameAlign, 'templ_company'),
        buildHdrEl(state.headerDate,        state.headerDateStyle,  state.headerDateAlign,  'templ_date'),
      ].filter(Boolean).join('\n');
      if (headerTextHtml) headerInnerHtml += '\n' + headerTextHtml;
    }

    // templ_content: 미리보기 DOM에서 추출 (편집 속성 제거)
    let sectionsHtml = '';
    const previewTemplContent = elements.previewContent?.querySelector('.templ_content');
    if (previewTemplContent) {
      const clone = previewTemplContent.cloneNode(true);
      cleanEditingAttrs(clone);
      sectionsHtml = clone.innerHTML;
    } else {
      sectionsHtml = state.convertedHtml || '';
    }

    let pfHtml = `<div id="templwrap_v3" class="result">
  <div class="templ_header" style="position: relative;">${headerInnerHtml ? `\n    ${headerInnerHtml}` : ''}
  </div>
  <!-- 본문 컨텐츠 -->
  <div class="templ_content">${sectionsHtml}
  </div>

  <div class="h20"></div>
  <div style="display:none"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>
</div>

<input style="margin: 0px; padding: 0px; border: 0px currentColor; width: 0px; height: 0px; font-size: 0px;" id="isIncruit" value="Y" type="hidden">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_basic3_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2022/css/job_post_v3_list_minify.css?${getCacheBuster()}">
<link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_button_minify.css?${getCacheBuster()}">
${state.kvEnabled ? getKvFontLinks() : ''}${state.kvEnabled ? `<style>\n${getKvCardStyles()}\n.kv-card { font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif; }\n</style>\n` : ''}<style>
  #templwrap_v3.result {max-width:698px;}
  #templwrap_v3 .templ_header h2 > span {color:#33423f;}
  #templwrap_v3 .sec_title_wrap h3{color:#33423f;}
  #templwrap_v3 .bTable_1 th {background-color: #33423f; color: #fff;}
  #templwrap_v3 .temp_btn{background:#33423f;}
  #templwrap_v3 th { background-color: #f1f5f9 !important; color: #000000 !important; }
  #templwrap_v3 .sec_title_icon span { background-color: #33423f !important; display: block !important; }
  #templwrap_v3 .title_bg .sec_title_icon .bul_2{margin-right: 5px;}
  #templwrap_v3.result .templ_header h2, #templwrap_v3.result .templ_header h2 *{font-size: 30px; margin-top: 10px;}
  #templwrap_v3 .legal-manual-num > li::before { content: none !important; display: none !important; }
  #templwrap_v3 .legal-manual-num > li.legal-1d { padding-left: 1.2em !important; text-indent: -1.2em; }
  #templwrap_v3 .legal-manual-num > li.legal-2d { padding-left: 1.5em !important; text-indent: -1.5em; }
  #templwrap_v3 .legal-manual-num > li.legal-sub-item { padding-left: 2.5em !important; text-indent: -2.5em; }
  #templwrap_v3 .legal-manual-num ol.kolist, #templwrap_v3 .legal-manual-num ul { margin-left: 2.5em; }
  #templwrap_v3 .legal-manual-num ol.kolist > li, #templwrap_v3 .legal-manual-num ul > li { text-indent: 0; padding-left: 0; }
  #templwrap_v3 .legal-manual-num ol.kolist > li::before, #templwrap_v3 .legal-manual-num ul > li::before { content: none !important; display: none !important; }
  #templwrap_v3 .legal-manual-num > li.legal-sub-item ol, #templwrap_v3 .legal-manual-num > li.legal-sub-item ul { text-indent: 0; }
  #templwrap_v3 li.has-marker::before { content: none !important; width: 0 !important; height: 0 !important; background: none !important; display: none !important; }
  ${dynamicCss}
</style>`;
    return applyPostTypeProcessing(pfHtml);
  }

  // 제목 추출
  const titleText = (() => {
    const t = document.createElement('div');
    t.innerHTML = state.convertedHtml || '';
    const h1 = t.querySelector('h1');
    return h1 ? h1.textContent.trim() : (state.jobNumber || '채용공고');
  })();

  const companyName = state.kv.companyName && state.kv.companyName !== '기업명' ? state.kv.companyName : '';

  // KV HTML 생성.
  // 우선순위: (0) 원본 붙여넣기 소스에 templwrap_v3가 있으면 거기서 templ_header 추출
  //             → 붙여넣은 커스텀 KV 배너 원본 그대로 보존 (extractInnerJobContent가
  //               preview 렌더 시엔 templ_content만 남겨 KV가 state에서 유실되기 때문)
  //           (1) 미리보기 DOM templ_header
  //           (2) state.kvEnabled면 #kv-preview-card
  //           (3) state의 KV URL → top_img_v2
  let kvHtml = '';
  try {
    const srcRaw = state.originalSource?.raw || '';
    if (srcRaw && /id=["']?templwrap_v3/i.test(srcRaw)) {
      const tmp = document.createElement('div');
      tmp.innerHTML = srcRaw;
      const origHeader = tmp.querySelector('#templwrap_v3 > .templ_header:not(.none)');
      if (origHeader && origHeader.children.length > 0) {
        kvHtml = origHeader.innerHTML.trim();
      }
    }
  } catch (_) {}

  if (!kvHtml) {
    const previewHeader = elements.previewContent?.querySelector('#templwrap_v3 > .templ_header:not(.none)');
    if (previewHeader && previewHeader.children.length > 0) {
      const headerClone = previewHeader.cloneNode(true);
      cleanEditingAttrs(headerClone);
      kvHtml = headerClone.innerHTML.trim();
    }
  }
  if (!kvHtml && state.kvEnabled) {
    const card = document.getElementById('kv-preview-card');
    if (card) {
      const cardClone = card.cloneNode(true);
      cleanEditingAttrs(cardClone);
      kvHtml = cardClone.outerHTML;
    }
  }
  if (!kvHtml && !state.kvEnabled) {
    const kvImageUrl = state.keyVisualUrl || state.kv.bgImageUrl || '';
    if (kvImageUrl) {
      kvHtml = `<img src="${kvImageUrl}" class="top_img_v2" alt="${companyName || '채용공고'} 키비주얼">`;
    }
  }

  // 미리보기 DOM에서 본문 콘텐츠 추출 (wrapInV3Sections + 테이블 클래스 + fixDoubleMarkers 적용 완료 상태)
  let sectionsHtml = '';
  const previewTemplContent = elements.previewContent?.querySelector('.templ_content');

  if (previewTemplContent) {
    // 미리보기 DOM을 클론하여 편집용 속성 제거
    const clone = previewTemplContent.cloneNode(true);
    cleanEditingAttrs(clone);
    sectionsHtml = clone.innerHTML;
  } else {
    // 미리보기가 없으면 기존 방식으로 폴백
    const sections = detectSectionsFromHtml(state.convertedHtml || '');
    if (sections.length > 0) {
      sectionsHtml = sections.map((section, index) =>
        wrapInSectionStructure(section, index, state.colorPrimary)
      ).join('\n');
    } else {
      sectionsHtml = wrapInSectionStructure(
        { title: '채용정보', content: state.convertedHtml || '<!-- 변환된 내용이 여기에 들어갑니다 -->' },
        0, state.colorPrimary
      );
    }
  }

  // 동적 CSS 생성 (타이틀 스타일 + 테이블 헤더 색상)
  const dynamicCss = buildIncruitDynamicStyles();

  // KV OFF일 때 헤더 텍스트 (공고번호, 기업명, 날짜) HTML 생성
  let headerTextHtml = '';
  if (!state.kvEnabled) {
    const buildHdrEl = (text, style, align, cls) => {
      if (!text) return '';
      const top = style?.top ?? 10;
      const fs  = style?.fontSize || 14;
      const col = style?.color || '#333333';
      const fw  = style?.bold ? '700' : '400';
      const ta  = align || 'left';
      return `      <p class="${cls}" style="position:absolute;top:${top}%;left:0;right:0;padding:0 4.444%;line-height:1.5;margin:0;text-align:${ta};font-size:${fs}px;color:${col};font-weight:${fw}">${text}</p>`;
    };
    headerTextHtml = [
      buildHdrEl(state.jobNumber,         state.jobNumberStyle,   state.jobNumberAlign,   'templ_num'),
      buildHdrEl(state.headerCompanyName, state.companyNameStyle, state.companyNameAlign, 'templ_company'),
      buildHdrEl(state.headerDate,        state.headerDateStyle,  state.headerDateAlign,  'templ_date'),
    ].filter(Boolean).join('\n');
  }

  const hasHeaderText = !state.kvEnabled && headerTextHtml;

  // 인크루트 표준 형식 HTML 생성
  let rawHtml = `<div id="templwrap_v3">
    <!-- 헤더: 키비주얼 -->
    <div class="templ_header"${hasHeaderText ? ' style="position:relative;"' : ''}>
${kvHtml ? `      ${kvHtml}` : ''}
${headerTextHtml}
    </div>

    <!-- 헤더: 제목 (KV 사용 시 숨김) -->
    <div class="templ_header none"${state.kvEnabled ? ' style="display:none"' : ''}>
      <h2>${titleText}</h2>
${companyName ? `      <h3>${companyName}</h3>` : ''}
    </div>

    <!-- 본문 콘텐츠 -->
    <div class="templ_content">
${sectionsHtml}
    </div>

  <div class="h20"></div>
  <div style="display:none"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>
  </div>

  <input id="isIncruit" value="Y" type="hidden">

  <!-- 인크루트 표준 CSS -->
  <link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_basic3_minify.css?${getCacheBuster()}">
  <link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_button_minify.css?${getCacheBuster()}">
  <link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2022/css/job_post_v3_list_minify.css?${getCacheBuster()}">
  <link rel="stylesheet" href="https://c.incru.it/HR/jobtemp/2024/css/job_post_v3_media_minify.css?${getCacheBuster()}">

${state.kvEnabled ? getKvFontLinks() : ''}${state.kvEnabled ? `  <style>\n${getKvCardStyles()}\n.kv-card { font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif; }\n  </style>\n` : ''}  <style>
    /* 커스텀 색상 오버라이드 (타이틀 스타일 + 테이블 헤더) */
    ${dynamicCss}
    /* 한국 법률 N의M 번호 (CSS 자동 번호 비활성화 + 자릿수별 hanging indent) */
    #templwrap_v3 .legal-manual-num > li::before { content: none !important; display: none !important; }
    #templwrap_v3 .legal-manual-num > li.legal-1d { padding-left: 1.2em !important; text-indent: -1.2em; }
    #templwrap_v3 .legal-manual-num > li.legal-2d { padding-left: 1.5em !important; text-indent: -1.5em; }
    #templwrap_v3 .legal-manual-num > li.legal-sub-item { padding-left: 2.5em !important; text-indent: -2.5em; }
    #templwrap_v3 .legal-manual-num > li.legal-sub-item ol, #templwrap_v3 .legal-manual-num > li.legal-sub-item ul { text-indent: 0; }
  </style>`;

  return applyPostTypeProcessing(rawHtml);
}

// 공고 타입 후처리 (모든 템플릿 공통)
function applyPostTypeProcessing(html) {
  // 웍스용 공고: media CSS 링크 제거
  if (state.isWorksPost) {
    html = html.replace(/<link[^>]*job_post_v3_media_minify\.css[^>]*>\n?/g, '');
  }
  // 구버전 rasp: #templwrap_v3에 class="rasp" 추가
  if (state.isRasp) {
    html = html.replace(/(<div\s+id=["']?templwrap_v3["']?)(\s+class="([^"]*)")?/g, (_, tag, _cls, existing) => {
      const classes = existing ? `${existing} rasp` : 'rasp';
      return `${tag} class="${classes}"`;
    });
  }
  // 외부 채용공고: copyright 이미지 block 표시
  // - 기존 display:none/block 버전이 있으면 display:block으로 교체(레이아웃 보존)
  // - 아예 없으면(소스 복사/붙여넣기 등 외부에서 가져온 HTML) 외부용 스타일로 주입
  if (state.isExternalPost) {
    const copyrightReplace = '<div style="display:block"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>';
    const copyrightInject = '<div style="display:block; width:900px; margin:0 auto;"><img src="https://c.incru.it/newjobpost/2026/common/copyright.png"></div>';
    const copyrightRe = /<div style="display:(?:none|block)"><img src="https:\/\/c\.incru\.it\/newjobpost\/2026\/common\/copyright\.png"><\/div>/g;
    if (copyrightRe.test(html)) {
      html = html.replace(copyrightRe, copyrightReplace);
    } else {
      const lastClose = html.lastIndexOf('</div>');
      if (lastClose !== -1) {
        html = html.substring(0, lastClose) + '  ' + copyrightInject + '\n  ' + html.substring(lastClose);
      } else {
        html += '\n' + copyrightInject;
      }
    }
  }

  // 불필요한 들여쓰기 스타일 제거 (Star→P 기능 스타일 정제)
  // 보존 조건:
  //   - hanging-indent-wrap / star-list-indent 클래스 (내어쓰기·별표 리스트)
  //   - border가 있는 요소 (테두리+여백)
  //   - padding-left + text-indent(음수) 쌍 (사용자 수동 hanging indent)
  //   - legal-manual-num 리스트 자릿수 클래스 (legal-1d, legal-2d, legal-sub-item)
  {
    const tmpDoc = new DOMParser().parseFromString(html, 'text/html');
    tmpDoc.querySelectorAll('[style]').forEach(el => {
      if (el.classList.contains('hanging-indent-wrap')) return; // 내어쓰기 span 유지
      if (el.classList.contains('star-list-indent')) return;    // Star→P 변환 p 유지
      if (el.classList.contains('legal-1d') ||
          el.classList.contains('legal-2d') ||
          el.classList.contains('legal-sub-item')) return;      // 법률 N의M 들여쓰기 유지
      const hasBorder = !!(el.style.border || el.style.borderWidth ||
                            el.style.borderLeft || el.style.borderRight ||
                            el.style.borderTop  || el.style.borderBottom);
      const pl = parseFloat(el.style.paddingLeft) || 0;
      const pr = parseFloat(el.style.paddingRight) || 0;
      const ti = parseFloat(el.style.textIndent)  || 0;
      // hanging indent 쌍: padding-left > 0 && text-indent < 0 → 사용자 의도적 들여쓰기, 유지
      const isHangingPair = pl > 0 && ti < 0;
      // 박스 좌우 padding(kv-job-code 등의 position:absolute 박스): padding-left/right 둘 다
      // 설정되어 있으면 의도적 좌우 여백으로 간주해 유지
      const isBoxHPadding = pl > 0 && pr > 0;
      if (!hasBorder && !isHangingPair && !isBoxHPadding) {
        el.style.removeProperty('padding-left');
        el.style.removeProperty('text-indent');
      }
      if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
    });
    html = tmpDoc.body.innerHTML;
  }

  return html;
}

/**
 * HEX 색상을 RGB 객체로 변환
 */
function hexToRgb(hex) {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function darkenHex(hex, factor = 0.2) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.max(0, Math.round(rgb.r * (1 - factor)));
  const g = Math.max(0, Math.round(rgb.g * (1 - factor * 1.5)));
  const b = Math.max(0, Math.round(rgb.b * (1 - factor)));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function lightenHex(hex, factor = 0.55) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor * 0.1));
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor));
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor * 0.1));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

/**
 * 버튼 스타일 클래스에 맞는 색상 CSS 생성 (inline style 없이 <style>에 출력)
 * 스타일별 수정 영역:
 *   btn         : background, 글자색
 *   btn2        : border-color, background, 글자색
 *   btn3        : background, 글자색 (= btn과 동일)
 *   btn4        : border-color, box-shadow rgba, 글자색 (배경 transparent)
 *   btn5        : border-color, background, 글자색
 *   btn6        : box-shadow rgba, background, 글자색
 *   btn7        : background + radial-gradient 2색, 글자색
 *   btn_a1      : background, 글자색 / hover: background(darker)
 *   btn_a2      : background, 글자색
 *   btn_a3      : box-shadow 그림자색(darker), background, 글자색 / hover: box-shadow
 *   btn_a4      : gradient (bg → darker → lighterG → bg)
 *   icon_carrow : border-color, background(tint), 글자색 / hover: background(bg), 글자색(tc)
 */
function buildBtnColorCss(btn, idx) {
  const sc  = btn.styleClass || 'temp_btn btn';
  const sel = `#templwrap_v3 .temp_btn[data-btn-idx="${idx}"]`;
  const I   = ' !important';   // 외부 CDN CSS 덮어쓰기용

  const bg  = btn.bgColor          || '#FF460A';
  const tc  = btn.textColor        || '#FFFFFF';
  const bc  = btn.borderColor      || bg;
  const sc2 = btn.shadowColor      || bg;
  const g1  = btn.gradColor1       || '#FFB40A';
  const g2  = btn.gradColor2       || bg;
  const hbg = btn.hoverBgColor     || darkenHex(bg);
  const htc = btn.hoverTextColor   || tc;
  const hsc = btn.hoverShadowColor || darkenHex(sc2);

  const scRgb  = hexToRgb(sc2);
  const rgba1  = scRgb ? `rgba(${scRgb.r},${scRgb.g},${scRgb.b},1)`   : sc2;
  const rgba50 = scRgb ? `rgba(${scRgb.r},${scRgb.g},${scRgb.b},0.5)` : sc2;

  if (sc.includes('icon_carrow')) {
    return `${sel}{border:2px solid ${bc}${I};color:${tc}${I};background:${bg}${I};}` +
           `${sel}:hover{background:${hbg}${I};color:${htc}${I};border-color:${bc}${I};}`;
  }
  if (sc.includes('btn_a4')) {
    const darker = darkenHex(bg);
    const bgRgb = hexToRgb(bg);
    const lighterG = bgRgb
      ? `#${bgRgb.r.toString(16).padStart(2,'0')}${Math.min(255,Math.round(bgRgb.g+(255-bgRgb.g)*0.6)).toString(16).padStart(2,'0')}${bgRgb.b.toString(16).padStart(2,'0')}`
      : bg;
    return `${sel}{background-image:linear-gradient(to right,${bg},${darker},${lighterG},${bg})${I};color:${tc}${I};}`;
  }
  if (sc.includes('btn_a3')) {
    return `${sel}{background:${bg}${I};color:${tc}${I};box-shadow:0 5px ${sc2}${I};}` +
           `${sel}:hover{box-shadow:0 3px ${hsc}${I};color:${htc}${I};}`;
  }
  if (sc.includes('btn_a1')) {
    return `${sel}{background:${bg}${I};color:${tc}${I};}` +
           `${sel}:hover{background:${hbg}${I};color:${htc}${I};}`;
  }
  if (sc.includes('btn7')) {
    return `${sel}{background:${bg}${I};background:radial-gradient(100% 100% at 100% 0,${g1} 0,${g2} 100%)${I};color:${tc}${I};}`;
  }
  if (sc.includes('btn6')) {
    return `${sel}{background:${bg}${I};color:${tc}${I};box-shadow:${rgba50} 0 9px 12px 0${I};}`;
  }
  if (sc.includes('btn4')) {
    return `${sel}{background:${bg}${I};border-color:${bc}${I};color:${tc}${I};box-shadow:5px 5px 0px ${rgba1}${I};}`;
  }
  if (sc.includes('btn5') || sc.includes('btn2')) {
    return `${sel}{border-color:${bc}${I};background:${bg}${I};color:${tc}${I};}`;
  }
  return `${sel}{background:${bg}${I};color:${tc}${I};}`;
}

// 콘텐츠 HTML 포맷팅 (들여쓰기 추가)
function formatHtmlContent(html, baseIndent = 4) {
  if (!html || html.trim().startsWith('<!--')) return '    ' + html;

  const indent = ' '.repeat(baseIndent);
  const lines = [];

  // 블록 태그 기준으로 줄바꿈
  const blockTags = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'th', 'td', 'thead', 'tbody', 'section', 'article', 'header', 'footer'];

  // 여는 태그 전에 줄바꿈
  let formatted = html;
  blockTags.forEach(tag => {
    // 여는 태그
    formatted = formatted.replace(new RegExp(`<${tag}(\\s|>)`, 'gi'), `\n<${tag}$1`);
    // 닫는 태그 후에 줄바꿈
    formatted = formatted.replace(new RegExp(`</${tag}>`, 'gi'), `</${tag}>\n`);
  });

  // 줄 단위로 분리 후 들여쓰기
  const rawLines = formatted.split('\n');
  let currentIndent = 0;

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 닫는 태그면 들여쓰기 감소
    const isClosing = /^<\/[a-z]/.test(trimmed);
    if (isClosing && currentIndent > 0) currentIndent--;

    lines.push(indent + '  '.repeat(currentIndent) + trimmed);

    // 여는 태그면 들여쓰기 증가 (자기 닫힘 제외)
    const isOpening = /^<[a-z][^\/]*>$/i.test(trimmed) && !trimmed.endsWith('/>');
    const hasClosing = /<\/[a-z]+>$/i.test(trimmed);
    if (isOpening && !hasClosing) currentIndent++;
  }

  return lines.join('\n');
}

// ============================================
// Rule-based Conversion (빠른 변환)
// ============================================
async function handleRuleConvert() {
  const sourceText = state.originalSource?.raw || state.sourceContent || elements.sourceEditor?.innerHTML;
  if (!sourceText || sourceText === '<br>') {
    addMessage('assistant', '변환할 원문이 아직 없네요. 채용공고 원문을 붙여넣거나, 파일 첨부 또는 URL을 입력해주세요.');
    return;
  }

  state.isLoading = true;
  state._loadingWsId = getActiveId();
  elements.btnRuleConvert.disabled = true;
  elements.btnRuleConvert.innerHTML = '<span class="loading"></span> 변환 중...';
  elements.btnConvert.disabled = true;
  setConvertingTabState(true);

  const _statsId = recordTaskStart('rule_convert');
  const progress = createProgressMessage();

  try {
    // ── v2 파이프라인 토글 (Step 15 P3 프로토타입) ──
    if (localStorage.getItem('pipeline_version') === 'v2') {
      const { convertV2 } = await import('./v2/index.js');
      const sv2 = progress.addStep('v2 파이프라인 — 구조/텍스트 분리 변환', '🔬');
      const result = await convertV2(sourceText, {
        apiKey: state.apiKey,
        model: state.model,
        provider: state.provider,
        useIncruitWrapper: true,
        onProgress: (msg) => progress.updateStep(sv2, msg, '🔬')
      });
      state.convertedHtml = result.html;
      elements.sourceEditor.innerHTML = result.html;
      state.sourceContent = result.html;
      updatePreview();
      refreshTitleStyleInPreview();
      const htmlSize = (result.html.length / 1024).toFixed(1);
      const grade = result.verifyReport.grade;
      const textMatch = result.verifyReport.textMatch;
      progress.completeStep(sv2, `${htmlSize}KB · ${grade} 등급 · 텍스트 ${textMatch}%`);
      progress.addResult(`✓ <strong>v2 변환 완료</strong> — ${grade} 등급 (텍스트 일치 ${textMatch}%)`);
      progress.finalize('v2 변환 완료');
      // 검증 결과를 마지막 메시지에 저장 (Step 14.6 게이트용)
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg) lastMsg.verifyResult = result.verifyReport;
      recordTaskEnd(_statsId, `v2 ${grade} 등급 (텍스트 ${textMatch}%)`);
      return;
    }

    const sourceSnapshot = sourceText;

    // ── Step 1: 원문 읽기 ──
    const sourceLen = sourceText.length;
    const sourceType = state.originalSource?.metadata?.filename || '직접 입력';
    const s1 = progress.addStep(`원문 읽기 — ${sourceType}`, '📄');
    const formatLabel = state.originalSource?.metadata?.format?.toUpperCase() || 'TEXT';
    progress.completeStep(s1, `${sourceLen.toLocaleString()}자 · ${formatLabel}`);

    // ── Step 2: 섹션 감지 + HTML 변환 ──
    const s2 = progress.addStep('섹션 감지 · HTML 변환', '⚡');
    const result = convertByRules(sourceText, {
      sanitizeForAI,
      applyHasMarkerClass
    });

    const matchedCount = result.sections.filter(s => s.sectionDef).length;
    const inputTypeLabel = { structured_html: 'HTML 구조', table_layout: '테이블', plain_text: '평문', already_incruit: '인크루트', empty: '빈 입력' }[result.inputType] || result.inputType;
    progress.completeStep(s2, `${inputTypeLabel} · ${matchedCount}개 섹션 감지 · 신뢰도 ${result.confidence}%`);

    // ── Step 3: 결과 적용 ──
    const s3 = progress.addStep('HTML 템플릿 적용', '📋');
    state.convertedHtml = result.html;
    elements.sourceEditor.innerHTML = result.html;
    state.sourceContent = result.html;
    updatePreview();
    refreshTitleStyleInPreview();
    const htmlSize = (result.html.length / 1024).toFixed(1);
    progress.completeStep(s3, `${htmlSize}KB HTML 생성 · 미리보기 반영 완료`);

    // ── Step 4: 원문 보존 검증 ──
    const s4 = progress.addStep('원문 보존 검증', '🔍');
    const verification = verifyConversion(sourceSnapshot, state.convertedHtml);
    const gradeInfo = `${verification.grade} 등급 (${verification.score}/100점, 일치율 ${verification.textMatch}%)`;
    progress.completeStep(s4, gradeInfo);

    // 검증 결과를 마지막 메시지에 저장 (Step 14.6 게이트용)
    const lastMsgForVerify = state.messages[state.messages.length - 1];
    if (lastMsgForVerify) lastMsgForVerify.verifyResult = verification;

    // ── Step 5: KV 초안 생성 ──
    const kvCreated = tryAutoFillKvFromSource();
    if (kvCreated) {
      const s5 = progress.addStep('키비주얼 초안 생성', '🎨');
      const kvTab = document.querySelector('.settings-tab[data-settings-tab="keyvisual"]');
      if (kvTab && !kvTab.querySelector('.kv-ready-badge')) {
        const badge = document.createElement('span');
        badge.className = 'kv-ready-badge';
        badge.textContent = '●';
        badge.style.cssText = 'color:#22c55e;font-size:10px;margin-left:4px;vertical-align:super;';
        kvTab.appendChild(badge);
      }
      progress.completeStep(s5, '자동 생성 완료');
    }

    // ── 워크스페이스 이름 자동 변경: 변환된 HTML에서 제목 추출 ──
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = state.convertedHtml;
      const heading = tmp.querySelector('h1, h2, h3');
      if (heading) {
        const title = heading.textContent.trim();
        if (title) autoRenameCurrentWorkspace(title, true);
      }
    } catch { /* ignore */ }

    // ── 신뢰도 낮으면 AI 변환 권장 ──
    if (result.confidence < 60) {
      progress.addResult('⚠ 섹션 감지 신뢰도가 낮습니다. <strong>AI 변환</strong>을 사용하면 더 정확한 결과를 얻을 수 있습니다.');
    }

    // ── 최종 결과 ──
    const copyBtns = buildCopyButtons(kvCreated);
    progress.addResult('✓ <strong>빠른 변환 완료</strong> — 미리보기를 확인해주세요.' + copyBtns);
    progress.finalize('빠른 변환 완료');

    // 통계 + 히스토리 기록
    recordTaskEnd(_statsId, `${verification.grade} 등급`);
    recordCharsProcessed(
      stripHtmlToText(sourceSnapshot).length,
      state.convertedHtml.length
    );
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = state.convertedHtml;
      const heading = tmp.querySelector('h1, h2, h3');
      addWorkHistory({
        wsName: getWorkspaceName(getActiveId()),
        jobTitle: heading?.textContent?.trim() || '',
        companyName: state.kv?.companyName || '',
        action: '빠른 변환',
        grade: verification.grade,
        source: state.originalSource?.type || '직접 입력'
      });
    } catch { /* ignore */ }

    // 차이점 하이라이트
    const diffResult = computeTextDiff(sourceSnapshot, state.convertedHtml);
    if (diffResult && diffResult.changeCount > 0) {
      const lastMsg = state.messages[state.messages.length - 1];
      lastMsg.diffHtml = diffResult.html;
      lastMsg.diffAddCount = diffResult.addCount;
      lastMsg.diffDelCount = diffResult.delCount;
      lastMsg.diffOpen = verification.grade !== 'A';
      renderSharedAiMessages();
    }
  } catch (error) {
    console.error('Rule conversion error:', error);
    recordTaskEnd(_statsId, '오류');
    const activeStep = document.querySelector(`#${progress.id} .progress-step.active`);
    if (activeStep) {
      const stepId = Number(activeStep.dataset.stepId);
      progress.failStep(stepId, error.message);
    }
    progress.addResult(`<span class="text-red-400">⚠ 오류: ${escapeHtml(error.message)}</span>`);
    progress.finalize(`오류: ${error.message}`);
  } finally {
    state.isLoading = false;
    state._loadingWsId = null;
    elements.btnRuleConvert.disabled = false;
    elements.btnRuleConvert.textContent = '⚡ 빠른 변환';
    elements.btnConvert.disabled = false;
    setConvertingTabState(false);
  }
}

// ============================================
// AI Conversion
// ============================================
async function handleConvert() {
  // 원문 소스: originalSource → sourceContent → sourceEditor 순서로 fallback
  const sourceText = state.originalSource?.raw || state.sourceContent || elements.sourceEditor?.innerHTML;
  if (!sourceText || sourceText === '<br>') {
    addMessage('assistant', '변환할 원문이 아직 없네요. 채용공고 원문을 붙여넣거나, 파일 첨부 또는 URL을 입력해주세요.');
    return;
  }

  if (!state.apiKey) {
    addMessage('assistant', 'AI API 키가 설정되지 않았습니다. 상단 설정(⚙️)에서 API 키를 먼저 입력해주세요.');
    return;
  }

  // ── v2 파이프라인 토글 (Step 15 P3 프로토타입) ──
  if (localStorage.getItem('pipeline_version') === 'v2') {
    state.isLoading = true;
    state._loadingWsId = getActiveId();
    elements.btnConvert.disabled = true;
    elements.btnConvert.innerHTML = '<span class="loading"></span> v2 변환 중...';
    elements.btnRuleConvert.disabled = true;
    setConvertingTabState(true);
    const _statsId = recordTaskStart('ai_convert');
    const progress = createProgressMessage();
    try {
      const { convertV2 } = await import('./v2/index.js');
      const sv2 = progress.addStep('v2 파이프라인 — 구조/텍스트 분리 변환', '🔬');
      const result = await convertV2(sourceText, {
        apiKey: state.apiKey,
        model: state.model,
        provider: state.provider,
        useIncruitWrapper: true,
        onProgress: (msg) => progress.updateStep(sv2, msg, '🔬')
      });
      state.convertedHtml = result.html;
      elements.sourceEditor.innerHTML = result.html;
      state.sourceContent = result.html;
      updatePreview();
      refreshTitleStyleInPreview();
      const htmlSize = (result.html.length / 1024).toFixed(1);
      const grade = result.verifyReport.grade;
      const textMatch = result.verifyReport.textMatch;
      progress.completeStep(sv2, `${htmlSize}KB · ${grade} 등급 · 텍스트 ${textMatch}%`);
      progress.addResult(`✓ <strong>v2 AI 변환 완료</strong> — ${grade} 등급 (텍스트 일치 ${textMatch}%)`);
      progress.finalize('v2 변환 완료');
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg) lastMsg.verifyResult = result.verifyReport;
      recordTaskEnd(_statsId, `v2 ${grade} 등급 (텍스트 ${textMatch}%)`);
    } catch (err) {
      progress.addResult(`변환 오류: ${err.message}`);
      progress.finalize('v2 변환 실패');
      addMessage('assistant', `v2 파이프라인 오류: ${err.message}`);
    } finally {
      state.isLoading = false;
      state._loadingWsId = null;
      elements.btnConvert.disabled = false;
      elements.btnConvert.textContent = '✨ AI 변환';
      elements.btnRuleConvert.disabled = false;
      elements.btnRuleConvert.textContent = '⚡ 빠른 변환';
      setConvertingTabState(false);
    }
    return;
  }

  // PDF Vision 강화 변환: PDF 소스 + 페이지 이미지 + Gemini 키 → Vision 교차 비교
  const isPdfSource = state.originalSource?.metadata?.format === 'pdf';
  const geminiKeyForVision = localStorage.getItem('ai_api_key_gemini') || (state.provider === 'gemini' ? state.apiKey : '');
  if (isPdfSource && state.pdfPageImages?.length > 0 && geminiKeyForVision && window._handlePdfVisionEnhanced) {
    const handled = await window._handlePdfVisionEnhanced(state.originalSource?.html || sourceText);
    if (handled) return;
  }

  // 워크스페이스 바인딩: 이 변환이 시작된 워크스페이스 ID를 캡처
  const originWsId = getActiveId();

  state.isLoading = true;
  state._loadingWsId = originWsId;
  elements.btnConvert.disabled = true;
  elements.btnConvert.innerHTML = '<span class="loading"></span> 변환 중...';

  // 변환 중 미리보기/HTML코드 탭 비활성화
  setConvertingTabState(true);

  const _statsId = recordTaskStart('ai_convert');
  // Progress UI 생성
  const progress = createProgressMessage();

  try {
    // 검증용 원문 HTML 스냅샷
    const sourceSnapshot = sourceText;

    // ── Step 1: 원문 읽기 ──
    const sourceLen = sourceText.length;
    const sourceType = state.originalSource?.metadata?.filename || '직접 입력';
    const s1 = progress.addStep(`원문 읽기 — ${sourceType}`, '📄');
    await sleep(150);
    const formatLabel = state.originalSource?.metadata?.format?.toUpperCase() || 'TEXT';
    progress.completeStep(s1, `${sourceLen.toLocaleString()}자 · ${formatLabel}`);

    // ── OCR 분기: 이미지 전용 콘텐츠 감지 ──
    const detection = detectImageOnlyContent(sourceText);
    let ocrResult = null;
    let effectiveSourceText = sourceText;

    if (detection.isImageOnly && detection.images.length > 0) {
      if (detection.hiddenText && detection.hiddenText.length > 50) {
        // 통이미지 + hidden text 패턴: OCR 없이 숨겨진 텍스트 활용
        const sHidden = progress.addStep(`통이미지 감지 — 숨겨진 텍스트 발견`, '🖼️');
        await sleep(150);
        const hiddenTextLen = stripHtmlToText(detection.hiddenText).length;
        progress.completeStep(sHidden, `이미지 ${detection.images.length}개 · 숨겨진 텍스트 ${hiddenTextLen.toLocaleString()}자`);

        effectiveSourceText = detection.hiddenText;
        // 접근성 div 생성 (OCR 결과와 동일한 구조)
        ocrResult = {
          ocrHtml: detection.hiddenText,
          ocrText: stripHtmlToText(detection.hiddenText),
          accessibleDiv: buildAccessibleDiv(detection.hiddenText),
          imageCount: detection.images.length
        };
      } else {
        // 통이미지 + hidden text 없음: Vision API OCR 수행
        ocrResult = await performOcrConversion(sourceText, detection, progress);
        effectiveSourceText = ocrResult.ocrHtml;
      }
    }

    // 변환 전 "N의M." 법률 번호 패턴 저장 (후처리에서 사용)
    const tmpParse = document.createElement('div');
    tmpParse.innerHTML = effectiveSourceText;
    const plainForLegal = tmpParse.textContent || '';
    const legalSubNumRe = /(\d+)의\s?(\d+)\.\s*(.{0,40})/g;
    state.legalSubNumbers = [];
    let lm;
    while ((lm = legalSubNumRe.exec(plainForLegal)) !== null) {
      state.legalSubNumbers.push({
        prefix: `${lm[1]}의${lm[2]}.`,
        snippet: lm[3].trim().substring(0, 15)
      });
    }
    // localStorage에도 저장 (updatePreview 재호출 시 복원용)
    if (state.legalSubNumbers.length > 0) {
      try { localStorage.setItem(wsKey('legal_sub_numbers'), JSON.stringify(state.legalSubNumbers)); } catch {}
    }

    // ── Step 2: 프롬프트 구성 ──
    const s2 = progress.addStep('변환 프롬프트 구성', '🔧');
    await sleep(100);
    const prompt = buildConversionPrompt(effectiveSourceText);
    const tmplName = templates[state.template]?.name || state.template;
    progress.completeStep(s2, `템플릿: ${tmplName} · 불릿: ${state.bulletStyle}`);

    // 원문 잘림 경고
    if (sourceLen > 50000) {
      progress.addStep(`⚠ 원문이 길어 ${(sourceLen - 50000).toLocaleString()}자가 잘렸습니다`, '⚠️');
    }

    // ── Step 3: AI API 호출 (스트리밍 + 라이브 상태) ──
    const providerName = AI_PROVIDERS[state.provider]?.name || state.provider;
    const modelName = state.model || '기본 모델';
    const s3 = progress.addStep(`${providerName} API 호출 — ${modelName}`, '🤖');

    // 라이브 타이머 + 변하는 상태 메시지
    const apiStart = Date.now();
    const statusPhases = [
      { icon: '🤖', text: '프롬프트 분석 중' },
      { icon: '🔍', text: '문서 구조 파악 중' },
      { icon: '📝', text: 'HTML 변환 중' },
      { icon: '📊', text: '테이블 변환 중' },
      { icon: '🎨', text: '스타일 적용 중' },
      { icon: '✨', text: '품질 검증 중' },
    ];
    let phaseIdx = 0;
    const timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - apiStart) / 1000);
      const phase = statusPhases[Math.min(phaseIdx, statusPhases.length - 1)];
      progress.updateStep(s3, `${phase.text}... ${elapsed}초`, phase.icon);
      // 5초마다 다음 단계로 전환
      if (elapsed > 0 && elapsed % 5 === 0 && phaseIdx < statusPhases.length - 1) phaseIdx++;
    }, 1000);

    const response = await callAI(prompt, (partialContent) => {
      progress.setStreamingPreview(partialContent);
    });

    clearInterval(timerInterval);
    progress.clearStreamingPreview();

    const tokenEst = Math.round(response.length / 3.5);
    let apiDetail = `응답 ${response.length.toLocaleString()}자 · ~${tokenEst.toLocaleString()} tokens`;
    if (state.lastContinuations > 0) {
      apiDetail += ` (이어쓰기 ${state.lastContinuations}회)`;
    } else if (state.lastContinuations === -1) {
      apiDetail += ' (⚠ 응답 잘림)';
    }
    progress.completeStep(s3, apiDetail);

    // ── 워크스페이스 전환 감지: 백그라운드 완료 처리 ──
    const convertedHtml = extractHtmlFromResponse(response);
    if (getActiveId() !== originWsId) {
      // 사용자가 다른 워크스페이스로 전환함 → 결과를 원래 워크스페이스에 저장
      const wsName = getWorkspaceName(originWsId);
      const htmlSize = (convertedHtml.length / 1024).toFixed(1);
      saveBackgroundResult(originWsId, convertedHtml,
        `✓ **채용공고 HTML 변환 완료** — ${htmlSize}KB HTML 생성 (백그라운드)`);
      showToast(`"${wsName}" 변환 완료 — 해당 작업으로 전환하면 결과를 확인할 수 있습니다.`);
      return; // DOM 업데이트 건너뛰기
    }

    // ── Step 4: HTML 추출 (같은 워크스페이스) ──
    const s4 = progress.addStep('HTML 템플릿 추출', '📋');
    await sleep(100);

    // OCR 결과가 있으면 접근성 태그 병합
    if (ocrResult) {
      state.convertedHtml = convertedHtml + '\n' + ocrResult.accessibleDiv;
    } else {
      state.convertedHtml = convertedHtml;
    }

    elements.sourceEditor.innerHTML = state.convertedHtml;
    state.sourceContent = state.convertedHtml;
    updatePreview();
    refreshTitleStyleInPreview();
    const htmlSize = (state.convertedHtml.length / 1024).toFixed(1);
    const ocrLabel = ocrResult ? ' · 접근성 태그 포함' : '';
    progress.completeStep(s4, `${htmlSize}KB HTML 생성 · 미리보기 반영 완료${ocrLabel}`);

    // ── Step 5: 원문 보존 검증 ──
    // OCR 시에는 OCR 추출 텍스트를 기준으로 검증
    const verifySource = ocrResult ? ocrResult.ocrHtml : sourceSnapshot;
    const s5 = progress.addStep('원문 보존 검증', '🔍');
    await sleep(100);
    const verification = verifyConversion(verifySource, state.convertedHtml);
    const gradeInfo = `${verification.grade} 등급 (${verification.score}/100점, 일치율 ${verification.textMatch}%)`;
    progress.completeStep(s5, gradeInfo);

    // 검증 결과를 마지막 메시지에 저장 (Step 14.6 게이트용)
    const lastMsgForVerify = state.messages[state.messages.length - 1];
    if (lastMsgForVerify) lastMsgForVerify.verifyResult = verification;

    // ── Step 6: KV 초안 생성 ──
    const kvCreated = tryAutoFillKvFromSource();
    if (kvCreated) {
      const s6 = progress.addStep('키비주얼 초안 생성', '🎨');
      await sleep(100);
      const kvTab = document.querySelector('.settings-tab[data-settings-tab="keyvisual"]');
      if (kvTab && !kvTab.querySelector('.kv-ready-badge')) {
        const badge = document.createElement('span');
        badge.className = 'kv-ready-badge';
        badge.textContent = '●';
        badge.style.cssText = 'color:#22c55e;font-size:10px;margin-left:4px;vertical-align:super;';
        kvTab.appendChild(badge);
      }
      progress.completeStep(s6, '자동 생성 완료');
    }

    // KV JSON 파싱
    tryApplyKvJson(response);

    // ── 워크스페이스 이름 자동 변경: 변환된 HTML에서 제목 추출 ──
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = state.convertedHtml;
      const heading = tmp.querySelector('h1, h2, h3');
      if (heading) {
        const title = heading.textContent.trim();
        if (title) autoRenameCurrentWorkspace(title, true);
      }
    } catch { /* ignore */ }

    // ── 최종 결과 ──
    const copyBtns = buildCopyButtons(kvCreated);
    progress.addResult('✓ <strong>채용공고 HTML 변환 완료</strong> — 미리보기를 확인해주세요.' + copyBtns);
    progress.finalize('채용공고 HTML 변환 완료');

    // 통계 + 히스토리 기록
    recordTaskEnd(_statsId, `${verification.grade} 등급`);
    recordCharsProcessed(
      stripHtmlToText(verifySource).length,
      state.convertedHtml.length
    );
    try {
      const tmp2 = document.createElement('div');
      tmp2.innerHTML = state.convertedHtml;
      const h = tmp2.querySelector('h1, h2, h3');
      addWorkHistory({
        wsName: getWorkspaceName(getActiveId()),
        jobTitle: h?.textContent?.trim() || '',
        companyName: state.kv?.companyName || '',
        action: 'AI 변환',
        grade: verification.grade,
        source: state.originalSource?.type || '직접 입력'
      });
    } catch { /* ignore */ }

    // 차이점 하이라이트 계산 및 메시지에 첨부
    const diffResult = computeTextDiff(verifySource, state.convertedHtml);
    if (diffResult && diffResult.changeCount > 0) {
      const lastMsg = state.messages[state.messages.length - 1];
      lastMsg.diffHtml = diffResult.html;
      lastMsg.diffAddCount = diffResult.addCount;
      lastMsg.diffDelCount = diffResult.delCount;
      lastMsg.diffOpen = verification.grade !== 'A';
      renderSharedAiMessages();
    }
  } catch (error) {
    recordTaskEnd(_statsId, error.name === 'AbortError' ? '중지' : '오류');
    if (error.name === 'AbortError') {
      progress.finalize('사용자가 중지했습니다.');
    } else {
      console.error('Conversion error:', error);
      // 진행 중인 마지막 active step을 실패로 표시
      const activeStep = document.querySelector(`#${progress.id} .progress-step.active`);
      if (activeStep) {
        const stepId = Number(activeStep.dataset.stepId);
        progress.failStep(stepId, error.message);
      }
      progress.addResult(`<span class="text-red-400">⚠ 오류: ${escapeHtml(error.message)}</span>`);
      progress.finalize(`오류: ${error.message}`);
    }
  } finally {
    // 같은 워크스페이스에 있을 때만 UI 복원
    if (getActiveId() === originWsId) {
      state.isLoading = false;
      state._loadingWsId = null;
      elements.btnConvert.disabled = false;
      elements.btnConvert.textContent = 'AI 변환 시작';
      setConvertingTabState(false);
    } else {
      // 백그라운드에서 완료 — 전역 로딩 해제
      state.isLoading = false;
      state._loadingWsId = null;
    }
  }
}

/** 변환 중 미리보기/HTML코드 탭 비활성화/활성화 */
function setConvertingTabState(isConverting) {
  elements.viewBtns.forEach(btn => {
    const view = btn.dataset.view;
    if (view === 'preview' || view === 'code') {
      btn.classList.toggle('tab-disabled', isConverting);
      btn.style.pointerEvents = isConverting ? 'none' : '';
    }
  });
}

function buildChatPrompt(userMessage) {
  const context = [
    `활성 탭: ${state.activeSettingsTab === 'keyvisual' ? '키비주얼' : '채용공고'}`,
    `채용공고 번호: ${state.jobNumber || '미입력'}`,
    `템플릿: ${templates[state.template]?.name || state.template}`,
    `원문 입력됨: ${state.sourceContent ? '예' : '아니오'}`,
    `변환 완료됨: ${state.convertedHtml ? '예' : '아니오'}`
  ].join('\n- ');

  // 오늘의 작업 통계
  const stats = getTodayStats();
  const statsText = stats.taskCount > 0
    ? `오늘(${todayStr()}) 작업: 총 ${stats.taskCount}건, 총 시간 ${stats.totalFormatted}${stats.breakdown ? ` (${stats.breakdown})` : ''}`
    : `오늘(${todayStr()}) 작업: 아직 없음`;

  // 누적 전체 통계
  const cumul = getCumulativeStats();

  // 최근 작업 히스토리
  const historyText = getRecentHistory(10);

  // 작업자 이름
  const workerName = localStorage.getItem('worker_name') || '';

  return `당신은 "인크루트 채용공고 에디터"의 AI 어시스턴트입니다.
채용공고를 작성하고 편집하는 작업자를 돕는 역할입니다.

## 성격과 말투
- 같은 팀 동료처럼 편안하고 친근하게 대화하세요.
- 작업자의 노고를 존중하고, 작업 결과에 대해 구체적으로 칭찬하세요. (예: "이 공고 깔끔하게 잘 정리하셨네요", "오늘 벌써 이만큼 하셨군요, 대단해요")
- 작업자가 전문가라는 자긍심을 느낄 수 있도록 격려하세요. 단, 과하거나 비현실적인 칭찬은 피하고 진심 어린 톤을 유지하세요.
- 분위기가 맞으면 가벼운 농담이나 유머를 섞어주세요. (예: "이 공고 보니까 저도 지원하고 싶어지는데요?", "오늘 공고 퀄리티가 퇴근 시간보다 빨리 올라가고 있어요")
- 한국어로 답변하고, 간결하되 필요한 정보는 빠짐없이 전달하세요.
- 이모지는 자제하되, 분위기에 맞게 가끔 사용해도 좋습니다.
${workerName ? `- 작업자 이름: "${workerName}" — 대화 중 자연스럽게 이름을 불러주세요.` : `- 작업자 이름을 아직 모릅니다. 자연스러운 타이밍에 "혹시 뭐라고 불러드리면 될까요?" 같이 이름이나 별명을 한 번만 물어보세요. 억지스럽지 않게, 대화 흐름에 맞춰 자연스럽게 물어보세요.`}

## 할 수 있는 일
- **채용공고 변환**: 원문(텍스트/HTML)을 인크루트 공식 HTML 템플릿으로 변환 (5가지 템플릿)
- **변환 검증**: 변환 결과와 원문을 대조하여 누락/변경 여부를 A~F 등급으로 검증
- **키비주얼(KV) 생성**: 채용공고 배너 이미지 자동 생성 (프리셋, 배경, 레이아웃 설정)
- **URL 추출**: 채용사이트 URL에서 공고 내용 자동 추출 (다양한 채용 플랫폼 지원)
- **파일 변환**: 첨부파일(PDF, DOCX, HWP, XLSX 등)에서 채용공고 텍스트 추출
- **통이미지 OCR**: 이미지 기반 공고에서 Vision API로 텍스트 추출
- **공고 요약**: 채용공고 핵심 정보를 한눈에 정리
- **핵심 역량 분석**: 직무 역량, 소프트 스킬, 회사 컬처 구조화 분석
- **작업 통계/히스토리**: 오늘·전체 작업 현황과 공고 히스토리 제공
- **일반 대화**: 채용공고 작성 팁, 질문 답변

## 현재 작업 상태
- ${context}

## 오늘의 작업 통계
${statsText}

## 전체 누적 통계
${cumul.summary}

## 최근 공고 작업 히스토리
${historyText}

## 중요
- 사용자가 "오늘 통계", "전체 통계", "작업 시간", "히스토리", "작업 현황", "몇 건" 등을 물으면 위 통계/히스토리 데이터를 기반으로 친절하게 정리해서 알려주세요.
- 전체 통계를 알려줄 때는 누적 데이터(총 건수, 처리 글자수, A등급 비율 등)도 포함하세요.
- 통계를 알려줄 때 작업자의 노고를 칭찬하는 한 마디를 꼭 추가하세요.
- 사용자가 이름이나 별명을 알려주면 "worker_name"이라는 키워드와 함께 "기억했어요!"라고 응답하세요. (시스템이 자동 저장합니다)

## 사용자 메시지
${userMessage}`;
}

function buildConversionPrompt(sourceText, userRequest) {
  const bulletMap = {
    check: '✓',
    circle: '●',
    arrow: '▶',
    star: '★',
    dash: '—',
    square: '■',
    ssquare: '▪',
    chevron: '❯ (CSS 셰브론)',
    number: '1. 2. 3. (자동 번호)',
    hangul: '하나. 둘. 셋. (한글 번호)'
  };

  // 구조 보존 HTML 추출: innerText(구조 유실) 대신 정제된 HTML 사용
  const rawHtml = sourceText || elements.sourceEditor?.innerHTML || '';
  const structuredContent = sanitizeForAI(rawHtml);

  // 입력 형식 자동 감지 (HTML 태그 존재 여부)
  const hasHtmlStructure = /<(?:table|ul|ol|h[1-6]|tr|td|th)\b/i.test(structuredContent);
  const wasConverted = state.originalSource?.metadata?.wasConverted;
  // 중첩 테이블 감지 (<td 또는 <th 안에 <table 이 있는 경우)
  const hasNestedTable = (() => {
    const tmp = document.createElement('div');
    tmp.innerHTML = structuredContent;
    return tmp.querySelector('td table, th table') !== null;
  })();
  let inputFormatNote;
  if (wasConverted) {
    inputFormatNote = '이 HTML은 이미 인크루트 형식으로 변환된 결과물입니다. 내용을 100% 보존하여 현재 템플릿의 새 양식으로 재구성하세요. 기존 구조를 최대한 유지하되, 새 템플릿 규칙에 맞게 적용합니다.';
  } else if (hasHtmlStructure) {
    inputFormatNote = '입력은 구조 태그가 포함된 HTML입니다. 기존 구조(table, ul/ol, heading 레벨)를 최대한 유지하세요.';
  } else {
    inputFormatNote = '입력은 평문 텍스트입니다. 내용을 분석하여 적절한 HTML 구조를 생성하세요.';
  }
  const nestedTableNote = hasNestedTable
    ? '\n\n## 🚨 중첩 테이블 감지됨\n이 문서에는 <td>/<th> 안에 <table>이 포함된 중첩 테이블이 있습니다. 최우선 규칙 6번을 반드시 준수하세요.'
    : '';

  return `채용공고 문서를 인크루트 스타일 HTML 템플릿으로 변환하세요.

## 🚨 최우선 규칙
1. 원문 텍스트 100% 보존 — 글자 하나 변경/추가/삭제 금지
2. 원문의 번호·기호 체계 100% 보존 (1., 가., ○, ※ 등)
3. 기존 구조 요소 보존 — table, ul/ol, heading 레벨을 그대로 유지
4. 환각(hallucination) 절대 금지
5. 내용을 요약·축약·재구성하지 마세요. 원문 전체를 빠짐없이 변환하세요.
   — 원문의 표(table)는 복잡하더라도 반드시 포함. 표를 통째로 생략하면 절대 안 됩니다.
6. 🚨 중첩 테이블 위치 절대 보존 — 셀(td/th) 안의 내부 테이블을 절대 바깥으로 꺼내지 마세요.
   ✅ 올바른 예: <td><table class="table_type bTable_1 stable fs15"><tr><td>내용</td></tr></table></td>
   ❌ 금지 예: <table>외부행</table><table>내부테이블이 분리됨</table>  ← 이렇게 하면 절대 안 됩니다
   셀 안 내부 테이블을 텍스트("4개 항목 평가" 등)로 대체하는 것도 절대 금지입니다.

## 입력 형식
${inputFormatNote}${nestedTableNote}
${(() => {
  const fmt = state.originalSource?.metadata?.format?.toLowerCase();
  if (fmt === 'pdf') {
    const hasPua = state.originalSource?.metadata?.hasPuaCharacters;
    return `\n## PDF 입력 특수 처리\n이 문서는 PDF에서 추출되었습니다. 다음 문제를 보정하세요:\n- 문장 중간에 끊어진 줄 → 하나의 문단으로 합쳐서 자연스러운 문장으로 복원\n- 의미 단위(문단, 항목, 표)를 파악하여 적절히 구조화\n- 표(table)가 텍스트로 풀려있으면 열 정렬을 분석하여 <table>로 재구성\n- 한국어 특수문자·기호(○●■①㉮※ 등)가 빠지거나 깨져있으면 문맥으로 복원${hasPua ? '\n- ⚠ HWP 전용 특수문자(PUA)가 감지되었습니다. 깨진 기호는 문맥에서 원래 기호를 추론하세요\n  예: 모집부문 앞 깨진 문자 → ○ 또는 ●, 항목 번호 앞 깨진 문자 → ① ② ③ 또는 가) 나) 다)' : ''}\n- 단, 실제 텍스트 내용(단어, 숫자, 기호)은 절대 변경 금지`;
  }
  return '';
})()}

## 섹션 감지 (h2 사용 기준)
아래 대분류 중 원문에 존재하는 것만 <h2> 섹션으로 만드세요:
회사소개, 모집부문/채용분야/채용규모, 담당업무, 자격요건, 우대사항, 근무조건, 급여/보수, 복리후생, 전형절차, 접수기간/방법, 기타안내

🚨 섹션(h2)이 되면 안 되는 것:
- 대분류 안의 세부 구분 (예: "가 일반직", "나 계약직", "다 무기계약직")
- 채용 유형·직종·직급별 하위 분류 (예: "계약직(한시정원)", "5급", "연구직")
- 이런 하위 구분은 <h3> 또는 <p><strong>제목</strong></p>으로 처리
- 원문에서 같은 대분류 아래 가/나/다 또는 ①②③으로 나뉜 항목들은 하나의 섹션 안에 유지

🚨 제목 삭제·병합 절대 금지:
- 원문에 "채용규모" 제목이 있고 그 아래 "채용분야별 인원" 소제목이 있으면 → <h2>채용규모</h2> + <h3>채용분야별 인원</h3> 각각 유지
- 섹션 제목과 소제목이 비슷해 보여도 절대 하나로 합치지 마세요
- 원문의 모든 제목(대제목, 소제목)은 빠짐없이 출력. 불필요해 보여도 삭제 금지

## HTML 태그 규칙
- 제목 → <h1>, 섹션 제목 → <h2> (CSS에서 "${bulletMap[state.bulletStyle]}" 아이콘이 자동 표시됨), 소제목 → <h3>
- 🚨 콘텐츠 블록 간 여백: 서로 다른 유형의 콘텐츠 사이에 <div class="h20"></div> 스페이서를 삽입하세요:
  · <p> 또는 <ul> 뒤에 <h3>가 오는 경우
  · <p> 또는 <ul> 뒤에 <table>이 오는 경우
  · <table> 뒤에 <p>, <h3>, <ul> 등이 오는 경우
  · ※ 주석(noti) 뒤에 다른 콘텐츠가 오는 경우
  예시: <p>※ 세부사항은...</p><div class="h20"></div><h3>□ 계약직</h3><div class="h20"></div><table>...</table>
- 목록 → <ul><li> (CSS에서 list-style:none이므로 기호를 텍스트로 보존)
- 🚨 <ul><li> 사용 조건 (Rule 3 예외): <li> 텍스트가 기호(●○▶▸※①②-·∙ 등)로 시작하지 않고, 단순 키-값("성명: 값", "지원분야: 값") 또는 일반 문장이면 → 입력 HTML에 <ul><li>가 있어도 <p>로 변환할 것. <ul><li>는 텍스트에 명시적 목록 기호가 있을 때만 사용
- 표 → <table> (colspan/rowspan 정확히 보존, 셀의 text-align 스타일 보존)
- 🚨 rowspan/colspan 정밀 계산 규칙:
  · rowspan은 현재 행부터 병합할 행의 개수를 의미함 (다음 행 개수 아님)
  · 예: 1행과 2행을 병합 → rowspan="2" (현재행 포함 2개 행)
  · 원문의 병합 구조를 정확히 파악한 후 rowspan 값 설정 (과대/과소 금지)
  · rowspan이 표의 높이를 초과하지 않도록 주의
  · colspan도 동일 규칙: 현재 열부터 병합할 열의 개수
  · 🚨 카테고리 셀의 rowspan 정밀 계산법:
    1단계: 해당 카테고리에 속하는 행의 수를 먼저 세세요
    2단계: 세어진 행의 수를 rowspan 값으로 설정
    예시: "사업" 카테고리에 11개 직위가 있으면 → <td rowspan="11">사업</td>
  · 🚨 열 수 보존: 원문 표의 열 수를 절대 변경하지 마세요. 4열 표는 4열 그대로 출력
  · 🚨 카테고리 계층 보존: 원문에서 "분야 > 하위분야 > 직위" 구조이면 각각 별도 <td>로 유지. 열을 합치거나 재구성 금지
- 🚨 원문에서 하나의 <table>인 표는 반드시 하나의 <table>로 변환. 복잡해 보여도 절대 여러 <table>로 분리 금지
- 🚨 중첩 테이블 — 셀(td/th) 안의 테이블은 절대 바깥으로 꺼내지 마세요 (최우선 규칙 6번 참고)
  · 내부 테이블 클래스: class="table_type bTable_1 stable fs15"
  · 외부 테이블 클래스: class="table_type bTable_1"
  · 올바른 구조: <td><table width="100%" border="1" class="table_type bTable_1 stable fs15"><tr><td>평가항목</td><td>배점</td></tr>...</table></td>
  · 셀 안의 내부 테이블을 텍스트("4개 항목 평가" 등)로 요약·대체하는 것 절대 금지
- 🚨 <th> 안에 <strong>/<b> 사용 금지 — <th>는 기본적으로 굵게 표시됨
- 🚨 <br> 태그 절대 금지 — 줄바꿈은 새로운 <p>, <li>, 테이블 셀로 표현
  ❌ <p>첫 줄<br>둘째 줄</p> (금지)
  ✅ <p>첫 줄</p><p>둘째 줄</p> (권장) 또는 <ul><li>첫 줄</li><li>둘째 줄</li></ul>
- 문단 → <p>, 강조 → <strong>
- 🚨 원문에 없는 색상 추가 금지: 원문에 색상 스타일이 없는 텍스트에 color, background-color 등을 임의로 추가하지 마세요. 원문이 검정색이면 검정색 그대로 출력. 단, 원문에 이미 지정된 색상(빨간색, 파란색 등)은 반드시 보존
- 🚨 링크(URL): 원문의 URL은 반드시 <a href="URL" target="_blank" class="noko">URL</a> 형식으로 변환. URL 자체가 링크 텍스트. target="_blank"과 class="noko" 필수
  예시: https://seoulwomen.hrdms.kr/ → <a href="https://seoulwomen.hrdms.kr/" target="_blank" class="noko">https://seoulwomen.hrdms.kr/</a>
- 인라인 스타일 최소화 (단, 표 셀의 text-align은 유지)
- 🚨 텍스트 배경색 필수 보존 — 원문에서 텍스트에 background-color(형광펜/하이라이트) 스타일이 있으면 반드시 <span style="background-color: 색상값;">...</span> 으로 보존
  예시: 원문 텍스트에 노란 배경 → <span style="background-color: #ffff00;">해당 텍스트</span>
- 🚨 원문의 모든 <table>은 반드시 빠짐없이 변환. 복잡한 표(colspan/rowspan 많음, 행이 많음)라도 절대 생략·축약 금지
- 🚨 테이블 셀 내용 100% 보존: 셀 안의 텍스트가 길거나 여러 줄이어도 한 글자도 빠뜨리지 마세요. 부가 설명, 괄호 안 내용, 부속 조건 등 모두 포함. 셀 내용을 요약하거나 줄이는 것은 환각과 동일한 위반입니다
- 🚨 원문에 없는 표를 새로 만들지 마세요 — 단, 아래 전형절차 예외는 제외
- 🚨 【예외】전형절차/채용절차 섹션: 원문이 평문이어도 단계별 흐름("지원접수 > 서류전형 > ..." 또는 "단계1 → 단계2 →...")은 반드시 <table>로 구조화할 것
  - 각 단계를 <td>로, '>' 또는 '→' 화살표는 별도 <td style="text-align:center">▶</td>로 표현
  - 배수 정보(예: "3배수", "1배수")는 단계명 아래 줄에 포함: <td>서류전형<br><span>(3배수)</span></td>
  - ※ 주석이 있으면 표 아래 <p>※ ...</p> 또는 <ul class="noti"><li>※ ...</li></ul>로 추가

## 🚨 원문 기호·번호 보존 (필수)
원문의 목록 기호와 번호 체계를 <li> 또는 <p> 안에 텍스트 그대로 유지하세요.
HTML 기본 마커(·, 1, 2, 3)로 대체하면 안 됩니다.
- 숫자 번호: 1. 2. 3. / 1) 2) / (1) (2) → <li>1. 내용</li>
- 한글 번호: 가. 나. 다. / 가) 나) → <li>가. 내용</li>
- 특수 기호: ○ ● ■ □ ▶ ★ ◆ ◇ ▪ ◎ ▣ ☐ ☑ → <li>○ 내용</li>
- 원문자: ① ② ③ ㉮ ㉯ ㉰ ㊀ ㊁ ㊟ → <li>① 내용</li>
- 주석 기호: ※ → 반드시 <ul class="ulist noti"><li>내용</li></ul> 형태로 (기호 제거 후 CSS로 표현). <p> 사용 금지
- 🚨 가운뎃점(·) 보존: "수집·활용", "채용·선발" 등 한국어 텍스트의 가운뎃점(·, U+00B7)은 용어 구분자. 절대 생략·변경·공백 치환 금지
- 🚨 별표(*) 주석 들여쓰기: 원문에서 *, **, *** 로 시작하는 주석이 있으면:
  · 모든 별표 줄에 동일 클래스 적용: <p class="star-list-indent" style="padding-left: 1.6em; text-indent: -1.6em;">
  · 별표가 적은 줄은 앞에 &amp;nbsp;를 추가하여 텍스트 시작 위치 정렬 (별 1개당 공백 약 2개)
  · 정렬 기준: 가장 많은 별표 수 기준으로, 부족한 별 수 × 2개의 &amp;nbsp;를 앞에 추가
  · 별표 기호를 ★ 등 다른 기호로 대체 금지
  예시 (최대 *** 기준):
    <p class="star-list-indent" style="padding-left: 1.6em; text-indent: -1.6em;">&amp;nbsp;&amp;nbsp;&amp;nbsp;&amp;nbsp;* 텍스트</p>
    <p class="star-list-indent" style="padding-left: 1.6em; text-indent: -1.6em;">&amp;nbsp;&amp;nbsp;** 텍스트</p>
    <p class="star-list-indent" style="padding-left: 1.6em; text-indent: -1.6em;">*** 텍스트</p>
  · *** 아래 하위 항목(1) 2) 3))은 더 깊은 들여쓰기:
    <p style="padding-left: 3.2em; text-indent: -1.6em;">1) 텍스트</p>
- ⚠️ 인식할 수 없는 특수문자도 원문 그대로 유지. 절대 - 또는 · 로 대체하지 마세요.
예시:
  원문 "가. 모집인원 : 3명" → <li>가. 모집인원 : 3명</li> (O)
  원문 "○ 차량순시정비보조" → <li>○ 차량순시정비보조</li> (O)
  원문 "㊟ 계약기간 만료 후..." → <li>㊟ 계약기간 만료 후...</li> (O)
  기호를 -로 대체 → (X) 절대 금지
  기호 누락 → (X) 절대 금지

## 🚨 법률·규정 조항 구조 변환 (필수)
채용공고에 법률 조항(제N조, 결격사유 등)이 포함된 경우, 원문의 계층 구조를 HTML 리스트로 정확히 재현하세요.

### 계층 변환 규칙:
- 조항 제목 (제10조, 제5조 등) → <h3> 또는 <p><strong>제10조(결격사유)</strong></p>
- 본문 번호 항목 (1. 2. 3. ...) → <ol><li>로 감싸기. 번호는 텍스트로 직접 표기
- 하위 항목 (가. 나. 다. / ①②③) → 부모 <li> 안에 중첩 <ol class="olist kolist">
- 각 항목의 들여쓰기 깊이를 원문과 동일하게 유지

### "N의M" 번호 체계 처리:
"6의1.", "6의2.", "10의3." 같은 "N의M" 형식:
- 모든 <li>에 번호를 텍스트로 직접 표기 (CSS 자동 번호에 의존 금지)
- "N의M" 항목은 하위 조항이므로 들여쓰기 적용
- 하위 목록(가. 나. 다.)은 <ol class="olist kolist">로 감쌈

### 변환 예시 (반드시 이 구조를 따를 것):
원문:
  제10조(결격사유) 다음 각 호의 1에 해당하는 자는 채용할 수 없다.
  1. 피성년후견인, 피한정후견인
  2. 파산선고를 받고 복권되지 아니한 사람
  ...
  6의1. 다음 각 목의 어느 하나에 해당하는 죄를 범한 사람으로서...
    가. 「성폭력범죄의 처벌 등에 관한 특례법」...
    나. 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」...
  6의2. 미성년자에 대하여...
  7. 징계로 파면처분을 받은 날부터 5년이 지나지 아니한 사람

변환결과:
  <p><strong>제10조(결격사유)</strong> 다음 각 호의 1에 해당하는 자는 재단 직원으로 채용할 수 없다.</p>
  <ol class="olist">
    <li>1. 피성년후견인, 피한정후견인</li>
    <li>2. 파산선고를 받고 복권되지 아니한 사람</li>
    <li>6. 법원의 판결...</li>
    <li>6의1. 다음 각 목의 어느 하나에 해당하는 죄를 범한 사람으로서...
      <ol class="olist kolist">
        <li>가. 「성폭력범죄의 처벌 등에 관한 특례법」...</li>
        <li>나. 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」...</li>
        <li>다. 「스토킹범죄의 처벌 등에 관한 법률」...</li>
      </ol>
    </li>
    <li>6의2. 미성년자에 대하여...
      <ol class="olist kolist">
        <li>가. 금고 이상의 실형을...</li>
        <li>나. 금고 이상의 형의 집행유예를...</li>
      </ol>
    </li>
    <li>7. 징계로 파면처분을 받은 날부터 5년이 지나지 아니한 사람</li>
  </ol>

## 설정
공고번호: ${state.jobNumber || '미입력'} | 템플릿: ${templates[state.template].name}

## HR-JSON / 인크루트 스펙 속성 매핑
각 섹션의 컨테이너에 data-hr-property 속성으로 HR-JSON 스펙 프로퍼티명을, data-incruit-field 속성으로 인크루트 필드명을 기록하세요.
이 속성들은 숨겨진 메타데이터로, 시각적으로 표시되지 않지만 시스템이 구조화된 데이터로 변환할 때 사용합니다.

### 속성 매핑 표
| 섹션 | data-hr-property | data-incruit-field |
|------|-------------------|--------------------|
| 기업/회사 소개 | description | company_info |
| 모집부문/직종 | title | recruit_title |
| 담당업무/직무내용 | responsibilities | job_description |
| 자격요건/지원자격 | qualifications | qualification |
| 우대사항/우대조건 | preferredQualifications | preferred |
| 근무조건/근무환경 | jobLocation + employmentType | work_condition |
| 급여/연봉 | baseSalary | salary |
| 복리후생/복지 | jobBenefits | benefits |
| 전형절차/채용절차 | applicationProcess | hiring_process |
| 접수기간/마감일 | validThrough | deadline |
| 접수방법/지원방법 | applicationContact | apply_method |
| 기타안내/참고사항 | additionalInfo | etc_info |

### 적용 예시
<div data-hr-property="responsibilities" data-incruit-field="job_description">
  <h2>담당업무</h2>
  <ul><li>...</li></ul>
</div>

## 원문
${structuredContent.substring(0, 50000)}${structuredContent.length > 50000 ? '\n\n[... 원문이 50,000자를 초과하여 이후 내용이 잘렸습니다]' : ''}

${userRequest ? `## 추가 요청\n${userRequest}\n` : ''}## 출력
순수 HTML만 출력하세요. 마크다운 코드 블록(\`\`\`) 없이 <h1>부터 바로 시작.
각 섹션을 <div data-hr-property="..." data-incruit-field="...">로 감싸세요.

HTML 출력이 끝나면 아래 형식의 JSON 블록을 추가하세요:
\`\`\`json
{
  "jobCode": "공고 제XXXX호 (원문에서 추출하거나 적절히 생성)",
  "title": "기업명\\n공고제목 (최대 3줄, 줄바꿈은 \\n)",
  "description": "회사/직무 핵심 소개 (최대 3줄, 줄바꿈은 \\n)",
  "date": "YYYY년 MM월 DD일 (마감일 또는 오늘 기준 2주 후)",
  "companyName": "기업명",
  "industry": "업종 키워드 (예: IT, 제조, 금융, 의료, 교육 등)"
}
\`\`\`
JSON의 각 필드는 원문에서 추출하거나 내용에 맞게 AI가 판단하여 최적의 값을 넣으세요.`;
}

/**
 * ★ 평문이나 <p>의 불릿 기호를 감지해서 <ul>/<li>로 자동 변환
 * 패턴: "1. ", "○ ", "가. " 등으로 시작하는 연속 줄 → <ul><li>로 감싸기
 */
/**
 * 테이블 셀 내 <strong> 항목 분리
 * 예: <td><strong>항목1</strong>: 내용1 <strong>항목2</strong>: 내용2</td>
 *     → <td><strong>항목1</strong>: 내용1<br><strong>항목2</strong>: 내용2</td>
 * 또는 <td><p><strong>항목1</strong>: 내용1</p><p><strong>항목2</strong>: 내용2</p></td>
 */
function separateTableCellItems(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  const cells = root.querySelectorAll('td, th');

  cells.forEach(cell => {
    const strongEls = Array.from(cell.querySelectorAll('strong, b'));
    // 2개 이상의 <strong> 있으면 분리
    if (strongEls.length >= 2) {
      // 모든 <strong> 요소의 다음에 <br> 삽입 (마지막 제외)
      for (let i = 0; i < strongEls.length - 1; i++) {
        const strong = strongEls[i];
        const br = doc.createElement('br');

        // <strong> 다음 형제 노드 찾기
        let nextNode = strong.nextSibling;
        if (nextNode) {
          nextNode.parentNode.insertBefore(br, nextNode);
        } else {
          // <strong>이 마지막 자식이면 부모의 다음 형제 찾기
          let parent = strong.parentNode;
          let nextParentSibling = parent.nextSibling;
          if (nextParentSibling) {
            nextParentSibling.parentNode.insertBefore(br, nextParentSibling);
          } else {
            parent.parentNode.appendChild(br);
          }
        }
      }
    }
  });

  return root.innerHTML;
}

function convertBulletTextToLists(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;

  // 불릿 패턴 정의: 숫자, 한글, 기호 등
  const bulletPattern = /^[\s]*([\d\-\w\u3000\u2000-\u200B\u25CB\u25CF\u25A1\u25A0\u25B2\u25B6\u25C0\u2605\u2764\u2714\u2716\u00AB\u00BB\u2022\u2013\u2014\u3010\u3011\u3008\u3009\u3014\u3015\u300C\u300D\u300E\u300F\u300A\u300B\u4E00-\u9FFF\uAC00-\uD7A3]+[\.)\-::\s]+)\s+/;

  // ★ 테이블 셀 내 불릿 처리 (- 항목 감지)
  function processCellBullets(cell) {
    const text = cell.textContent.trim();

    // 1. " - " 로 분리된 불릿 항목들 감지 (한 줄에 여러 항목)
    // 포맷팅 보존: HTML 구조는 유지하되, " - "를 감지
    if (text.includes(' - ')) {
      const items = text.split(/\s+-\s+/).filter(s => s.trim());
      if (items.length > 1) {
        const ul = doc.createElement('ul');
        // 원본 HTML에서 각 항목별 내용 추출 (포맷팅 유지)
        let currentIndex = 0;
        items.forEach((item, idx) => {
          const li = doc.createElement('li');

          // 원본 HTML에서 이 항목 텍스트의 위치를 찾기
          const itemStart = cell.innerHTML.indexOf(item, currentIndex);
          if (itemStart >= 0) {
            const itemEnd = itemStart + item.length;
            const itemHtml = cell.innerHTML.substring(itemStart, itemEnd);
            li.innerHTML = itemHtml;
            currentIndex = itemEnd;
          } else {
            // 폴백: 텍스트만 복사
            li.textContent = item.trim();
          }

          ul.appendChild(li);
        });
        cell.innerHTML = '';
        cell.appendChild(ul);
        return true;
      }
    }

    // 2. 여러 줄의 - 항목 감지 (포맷팅 보존)
    const cellHtml = cell.innerHTML;
    const cellText = cell.textContent;
    const tempDiv = doc.createElement('div');

    // 셀 텍스트에서 " - " 또는 줄 시작 "-" 패턴 감지
    const dashPattern = /(?:^|\n)\s*-\s+/m;
    const hasMultipleDashes = (cellText.match(/\n\s*-\s+/g) || []).length >= 2;

    if (!hasMultipleDashes && !dashPattern.test(cellText)) {
      return false; // - 항목 없음
    }

    // 블록 요소를 마커로 변환
    let markedHtml = cellHtml
      .replace(/<\/p>\s*<p[^>]*>/gi, '|||BR|||')
      .replace(/<\/div>\s*<div[^>]*>/gi, '|||BR|||')
      .replace(/<br\s*\/?>/gi, '|||BR|||');

    // 마커로 분할된 블록 추출
    const blocks = markedHtml.split('|||BR|||').map(b => b.trim()).filter(b => b);

    // 각 블록의 텍스트 콘텐츠 추출 (- 감지용)
    const blockInfo = blocks.map(blockHtml => {
      tempDiv.innerHTML = blockHtml;
      const blockText = tempDiv.textContent.trim();
      return {
        html: blockHtml,
        text: blockText,
        startsDash: /^-\s+/.test(blockText)
      };
    });

    // - 로 시작하는 항목들 찾기
    const dashIndices = blockInfo
      .map((info, idx) => info.startsDash ? idx : -1)
      .filter(idx => idx >= 0);

    // 2개 이상의 - 항목이 있으면 리스트로 변환
    if (dashIndices.length >= 2) {
      const ul = doc.createElement('ul');

      dashIndices.forEach(idx => {
        const li = doc.createElement('li');
        const blockHtml = blockInfo[idx].html;
        // HTML에서 맨 앞의 - 만 제거 (포맷팅 태그는 유지)
        const cleanedHtml = blockHtml.replace(/^(\s*)-(\s+)/, '');
        li.innerHTML = cleanedHtml;
        ul.appendChild(li);
      });

      cell.innerHTML = '';
      cell.appendChild(ul);
      return true;
    }

    return false;
  }

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    // <ul>/<ol>은 이미 리스트이므로 스킵
    if (node.tagName === 'UL' || node.tagName === 'OL') return;

    // ★ 테이블 셀 처리 (TD, TH)
    if ((node.tagName === 'TD' || node.tagName === 'TH') && !processCellBullets(node)) {
      // 셀 내 자식 재귀 처리
      const children = Array.from(node.childNodes);
      children.forEach(child => processNode(child));
      return;
    }

    const children = Array.from(node.childNodes);
    let i = 0;

    while (i < children.length) {
      const child = children[i];

      // <p> 태그에서 불릿 시작 감지
      if (child.tagName === 'P' && bulletPattern.test(child.textContent)) {
        // 불릿이 시작됨 → 연속된 불릿 수집
        const listItems = [];
        let j = i;

        while (j < children.length) {
          const el = children[j];
          if (el.tagName !== 'P') break;

          const text = el.textContent.trim();
          if (!bulletPattern.test(text)) break; // 불릿 패턴 벗어남 → 중단

          listItems.push(el);
          j++;
        }

        if (listItems.length > 0) {
          // <ul>로 감싸기
          const ul = doc.createElement('ul');

          listItems.forEach(pEl => {
            const li = doc.createElement('li');
            // <p>의 모든 자식 복사 (텍스트 + 태그)
            while (pEl.firstChild) {
              li.appendChild(pEl.firstChild);
            }
            ul.appendChild(li);
          });

          // 첫 번째 <p>를 <ul>로 대체, 나머지 제거
          node.replaceChild(ul, listItems[0]);
          listItems.slice(1).forEach(pEl => pEl.remove());

          // children 배열 업데이트 (삭제된 요소들 반영)
          children.splice(i + 1, listItems.length - 1);

          i += 1; // <ul>로 넘어감
        } else {
          i++;
        }
      } else {
        // 재귀적으로 자식 처리
        processNode(child);
        i++;
      }
    }
  }

  processNode(root);
  return root.innerHTML;
}

/**
 * <br> 태그를 컨텍스트별로 처리:
 * 1. <td>/<th> 안의 <br> → 보존 (테이블 셀 내 줄바꿈 유지)
 * 2. <p> 안의 <br> → <p>를 분리 (불릿 감지용)
 * 3. 그 외 → 공백으로 치환 (기존 동작 유지)
 */
function processBrTagsByContext(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;

  // <ul>/<ol>의 직계 자식 <br>은 무조건 제거 (li 사이 줄바꿈 방지)
  root.querySelectorAll('ul > br, ol > br').forEach(br => br.remove());

  // 모든 <br> 수집 (라이브 NodeList이므로 배열로 복사)
  const brElements = Array.from(root.querySelectorAll('br'));

  for (const br of brElements) {
    // 조상에 <td> 또는 <th>가 있으면 보존
    if (br.closest('td, th')) {
      continue;
    }

    const parent = br.parentElement;

    // 부모가 <p>이면 <br> 기준으로 <p>를 분리
    if (parent && parent.tagName === 'P') {
      // <br> 이후의 노드들을 새 <p>로 이동 (원본 속성 복사)
      const newP = doc.createElement('p');
      for (const attr of parent.attributes) { newP.setAttribute(attr.name, attr.value); }
      // <br> 이후 형제 노드들을 새 <p>로 이동
      while (br.nextSibling) {
        newP.appendChild(br.nextSibling);
      }
      // 원래 <p> 뒤에 새 <p> 삽입
      parent.parentNode.insertBefore(newP, parent.nextSibling);
      // <br> 제거
      br.remove();
    } else {
      // 그 외: 공백 텍스트 노드로 교체
      br.replaceWith(doc.createTextNode(' '));
    }
  }

  // 빈 <p> 태그 정리 (공백만 있는 <p> 제거, 테이블 셀 내부 제외)
  const allPs = Array.from(root.querySelectorAll('p'));
  for (const p of allPs) {
    if (!p.closest('td, th') && !p.textContent.trim()) {
      p.remove();
    }
  }

  // 테이블 셀 내 연속 <br> 정리: <br><br> → <br> (과도한 줄바꿈 방지)
  root.querySelectorAll('td, th').forEach(cell => {
    const brs = Array.from(cell.querySelectorAll('br'));
    for (let i = 0; i < brs.length; i++) {
      const br = brs[i];
      const next = br.nextSibling;
      // 다음 형제가 <br>이거나 공백 텍스트 후 <br>이면 현재 br 제거
      if (next && next.nodeName === 'BR') {
        br.remove();
      } else if (next && next.nodeType === 3 && !next.textContent.trim() && next.nextSibling?.nodeName === 'BR') {
        br.remove();
      }
    }
  });

  return root.innerHTML;
}

function extractHtmlFromResponse(response) {
  let html = response;

  // JSON 블록 이전까지만 HTML로 추출 (```json ... ``` 제거)
  const jsonBlockIdx = html.indexOf('```json');
  if (jsonBlockIdx > 0) {
    html = html.substring(0, jsonBlockIdx);
  }

  // Remove markdown code blocks and block headers if present
  html = html
    .replace(/```html\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/^###?\s*블록\d[::]\s*.+$/gm, '')
    .trim();

  // 테이블 셀 <strong> 항목 분리 비활성 — 원문 HWP 구조를 AI 출력 그대로 유지
  // 이전엔 strong 2개 이상이면 자동으로 <br> 삽입했으나, 문장 중간 강조까지 끊는
  // false positive 발생. AI가 원문 BR을 그대로 출력하므로 후처리 불필요.
  // html = separateTableCellItems(html);

  // <li> 이중 마커 방지: 원문 기호가 텍스트에 이미 있으면 has-marker 클래스 삽입
  html = applyHasMarkerClass(html);

  // ★ <br> 컨텍스트별 처리 (불릿 패턴 감지 전에!)
  // td/th 안: 보존 | p 안: <p> 분리 | 그 외: 공백 치환
  html = processBrTagsByContext(html);

  // ★ AI가 평문이나 <p>로 생성한 불릿을 자동으로 <ul>/<li>로 변환
  // (<br> 제거 후에 실행하여 불릿 감지 정확성 향상)
  html = convertBulletTextToLists(html);

  // <th> 안의 <strong>/<b> 제거 — th는 기본 bold이므로 불필요
  html = html.replace(/<th([^>]*)>([\s\S]*?)<\/th>/gi, (_, attrs, inner) => {
    const cleaned = inner.replace(/<\/?(strong|b)(\s[^>]*)?>/gi, '');
    return `<th${attrs}>${cleaned}</th>`;
  });

  // AI가 td/th 밖으로 꺼낸 중첩 테이블을 올바른 셀 안으로 재배치
  html = renestOrphanedTables(html);

  // 섹션 타이틀이 단일 셀 테이블(또는 colspan 풀 너비 <th>)로 감싸진 환각 제거
  html = unwrapSectionTitleTables(html);

  return html;
}

/**
 * 섹션 타이틀이 <table>의 <th>로 환각된 케이스를 <h3>로 언래핑.
 * 대상 패턴:
 *   1. <table>이 행 1개, 셀 1개이고 셀 텍스트가 ◎/◈/◇/■/□/▣로 시작
 *   2. <table>의 첫 행이 colspan=전체너비 <th>이고 텍스트가 ◎/◈/◇/■/□/▣로 시작
 *      → 해당 행만 제거하고 <h3>를 table 앞에 삽입
 */
function unwrapSectionTitleTables(html) {
  const SECTION_BULLET_RE = /^\s*[◎◈◇■□▣●○◆]\s*/;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;

  const tables = Array.from(root.querySelectorAll('table'));
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll(':scope > tbody > tr, :scope > tr'));
    if (rows.length === 0) continue;

    // 패턴 1: 1행 1셀 제목 테이블
    if (rows.length === 1) {
      const cells = Array.from(rows[0].children);
      if (cells.length === 1) {
        const text = (cells[0].textContent || '').trim();
        if (SECTION_BULLET_RE.test(text)) {
          const titleText = text.replace(SECTION_BULLET_RE, '').trim();
          const h3 = doc.createElement('h3');
          h3.textContent = titleText;
          const wrapper = table.closest('.table_x') || table;
          wrapper.parentNode.replaceChild(h3, wrapper);
          continue;
        }
      }
    }

    // 패턴 2: 첫 행이 colspan 풀 너비 <th>이고 텍스트가 섹션 불릿으로 시작
    const firstRow = rows[0];
    const firstCells = Array.from(firstRow.children);
    if (firstCells.length === 1) {
      const cell = firstCells[0];
      const text = (cell.textContent || '').trim();
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      // 다른 행들의 셀 수와 비교하여 full-width인지 확인
      const otherRowColCount = rows.length > 1
        ? Array.from(rows[1].children).reduce((sum, c) => sum + parseInt(c.getAttribute('colspan') || '1', 10), 0)
        : 0;
      if (SECTION_BULLET_RE.test(text) && (colspan >= otherRowColCount || otherRowColCount === 0)) {
        const titleText = text.replace(SECTION_BULLET_RE, '').trim();
        const h3 = doc.createElement('h3');
        h3.textContent = titleText;
        const wrapper = table.closest('.table_x') || table;
        wrapper.parentNode.insertBefore(h3, wrapper);
        firstRow.remove();
      }
    }
  }

  return root.innerHTML;
}

/**
 * AI가 <td>/<th> 밖으로 꺼낸 중첩 테이블(stable fs15)을
 * 바로 뒤에 오는 외부 테이블의 적절한 셀 안으로 재배치한다.
 *
 * 패턴:
 *   [orphaned stable-fs15 table 1]
 *   [orphaned stable-fs15 table 2]
 *   [outer table with placeholder cells "4개 항목 평가" etc.]
 * → outer table의 플레이스홀더 셀 안으로 순서대로 삽입
 */
function renestOrphanedTables(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;

  let changed = false;

  // 직계 자식 목록을 반복하며 orphaned stable 테이블 그룹 탐지
  let kids = Array.from(root.children);
  let i = 0;
  while (i < kids.length) {
    const el = kids[i];
    // orphaned inner table: stable + fs15 클래스, td/th 안에 없음
    if (el.tagName !== 'TABLE' || !el.classList.contains('stable') || !el.classList.contains('fs15')) {
      i++;
      continue;
    }

    // 연속된 orphaned stable 테이블 수집
    const orphans = [];
    let j = i;
    while (j < kids.length &&
           kids[j].tagName === 'TABLE' &&
           kids[j].classList.contains('stable') &&
           kids[j].classList.contains('fs15')) {
      orphans.push(kids[j]);
      j++;
    }

    // 바로 다음 요소가 outer table이어야 함 (stable 아닌 table)
    if (j < kids.length && kids[j].tagName === 'TABLE' && !kids[j].classList.contains('stable')) {
      const outerTable = kids[j];
      const targets = findTargetCells(outerTable, orphans.length);

      if (targets.length === orphans.length) {
        orphans.forEach((orphan, idx) => {
          targets[idx].innerHTML = '';
          targets[idx].appendChild(orphan.cloneNode(true));
          orphan.parentNode.removeChild(orphan);
        });
        changed = true;
        // 자식 목록 갱신
        kids = Array.from(root.children);
        i = kids.indexOf(outerTable) + 1;
        continue;
      }
    }

    i = j + 1;
  }

  return changed ? root.innerHTML : html;
}

/**
 * outer table에서 orphaned inner table이 들어가야 할 셀을 찾는다.
 * 기준: 같은 행 안에 "동일한 짧은 텍스트"만 있는 셀들 (플레이스홀더 패턴)
 * 또는 텍스트가 없거나 짧은(≤50자) 셀이 count개 연속되는 행
 */
function findTargetCells(table, count) {
  const rows = Array.from(table.querySelectorAll('tr'));

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td, th'));
    if (cells.length < 2) continue;

    // 이미 table 자식이 없고, 텍스트가 짧은 셀 후보
    const candidates = cells.filter(c =>
      !c.querySelector('table') && c.textContent.trim().length <= 50
    );

    if (candidates.length < count) continue;

    // 후보 셀 중 마지막 count개가 서로 동일한 텍스트이면 플레이스홀더로 판단
    const last = candidates.slice(-count);
    const texts = last.map(c => c.textContent.trim());
    const allSame = texts.every(t => t === texts[0]);
    const allEmpty = texts.every(t => t === '');

    if (allSame || allEmpty) {
      return last;
    }
  }

  return [];
}

/**
 * HTML 문자열의 <li> 태그에서 원문 기호가 텍스트로 시작하면
 * has-marker 클래스를 부여하여 CSS ::before 마커를 숨긴다.
 * 복사된 HTML에도 적용되므로 인크루트 사이트에서도 이중 마커가 방지된다.
 */
function applyHasMarkerClass(html) {
  const MARKER_RE = /^\s*(?:[○●■□▶▷★☆※•◆◇▪◎▣☐☑▲△►▻·\-\u2022\u2023\u2043]|[\u2460-\u249B]|[\u326E-\u327B]|[\u3280-\u32B0]|\(\d{1,3}\)\s|\d{1,3}[.)]\s|[가-힣][.)]\s)/;

  // DOMParser로 안전하게 파싱
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = doc.body.firstChild;
  let modified = false;

  wrapper.querySelectorAll('li').forEach(li => {
    const parentUl = li.closest('ul');
    const isNoti = parentUl && parentUl.classList.contains('noti');
    const text = li.textContent.trimStart();
    if (!text) return;
    if (isNoti) {
      // noti 리스트: ※ 기호만 텍스트에서 제거, has-marker 부여 안 함
      if (/^\s*[※\u203B]\s*/.test(text)) {
        li.innerHTML = li.innerHTML.replace(/^\s*[※\u203B]\s*/, '');
        modified = true;
      }
    } else if (MARKER_RE.test(text)) {
      li.classList.add('has-marker');
      li.style.listStyle = 'none';
      modified = true;
    }
  });

  return modified ? wrapper.innerHTML : html;
}

// ============================================
// OCR (이미지 전용 콘텐츠)
// ============================================

/**
 * 이미지 전용 콘텐츠 감지
 * @param {string} html - 추출된 HTML
 * @returns {{ isImageOnly: boolean, images: Array<{src: string, alt: string}>, textLength: number }}
 */
function detectImageOnlyContent(html) {
  if (!html) return { isImageOnly: false, images: [], textLength: 0 };

  const temp = document.createElement('div');
  temp.innerHTML = html;

  // img 태그 수집
  const imgEls = temp.querySelectorAll('img[src]');
  const images = Array.from(imgEls).map(img => ({
    src: img.getAttribute('src'),
    alt: img.getAttribute('alt') || '',
    width: img.getAttribute('width') || '',
    height: img.getAttribute('height') || ''
  })).filter(img => {
    // 트래킹 픽셀, spacer, 아이콘 제외
    const src = img.src.toLowerCase();
    if (src.includes('pixel') || src.includes('tracking') || src.includes('spacer')) return false;
    if (src.includes('1x1') || src.includes('blank.gif')) return false;
    const w = parseInt(img.width);
    const h = parseInt(img.height);
    if (w && h && (w < 50 || h < 50)) return false;
    return true;
  });

  // display:none 요소에서 숨겨진 텍스트 추출 (통이미지 + SEO 텍스트 패턴)
  let hiddenText = '';
  const hiddenEls = temp.querySelectorAll('[style*="display:none"], [style*="display: none"]');
  hiddenEls.forEach(el => {
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (text.length > 50) {
      hiddenText += el.innerHTML;
    }
    el.remove(); // 텍스트 측정에서 제외
  });

  // 이미지 + style 태그 제거 후 남은 가시 텍스트 길이 측정
  imgEls.forEach(img => img.remove());
  temp.querySelectorAll('style, script').forEach(el => el.remove());
  const textContent = temp.textContent.replace(/\s+/g, ' ').trim();
  const textLength = textContent.length;

  // 이미지가 있고 가시 텍스트가 100자 미만이면 이미지 전용
  const TEXT_THRESHOLD = 100;
  const isImageOnly = images.length > 0 && textLength < TEXT_THRESHOLD;

  return { isImageOnly, images, textLength, hiddenText };
}

/**
 * 이미지 URL을 base64로 변환 (CORS 프록시 경유)
 * @param {Array<{src: string}>} images
 * @returns {Promise<Array<{base64: string, mimeType: string, src: string}>>}
 */
async function extractImagesAsBase64(images) {
  const PROXY_BASE = '/proxy/?url=';
  const MAX_IMAGES = 10;
  const MAX_SIZE_BYTES = 20 * 1024 * 1024;

  // 이미지 매직 바이트 검증 (JPEG, PNG, GIF, WebP, BMP)
  const IMAGE_SIGNATURES = [
    [0xFF, 0xD8, 0xFF],             // JPEG
    [0x89, 0x50, 0x4E, 0x47],       // PNG
    [0x47, 0x49, 0x46],             // GIF
    [0x52, 0x49, 0x46, 0x46],       // WebP (RIFF)
    [0x42, 0x4D],                   // BMP
  ];

  function isValidImage(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer).slice(0, 8);
    return IMAGE_SIGNATURES.some(sig =>
      sig.every((b, i) => bytes[i] === b)
    );
  }

  const imagesToProcess = images.slice(0, MAX_IMAGES);
  const results = [];

  for (const img of imagesToProcess) {
    try {
      let fetchUrl = img.src;

      // 상대 URL → 절대 URL 변환
      if (fetchUrl.startsWith('//')) {
        fetchUrl = 'https:' + fetchUrl;
      } else if (fetchUrl.startsWith('/')) {
        const baseUrl = state.originalSource?.metadata?.url;
        if (baseUrl) {
          const u = new URL(baseUrl);
          fetchUrl = u.origin + fetchUrl;
        }
      }

      // 1차: 직접 fetch (CORS 허용 이미지)
      // 2차: CORS 프록시 경유 (CORS 차단 시)
      let arrayBuffer;
      let contentType = '';

      try {
        const directResp = await fetch(fetchUrl, {
          headers: { 'Accept': 'image/*' },
          signal: AbortSignal.timeout(5000)
        });
        if (directResp.ok) {
          contentType = directResp.headers.get('Content-Type') || '';
          arrayBuffer = await directResp.arrayBuffer();
        } else {
          throw new Error('direct fetch failed');
        }
      } catch {
        // CORS 차단 → 프록시 경유
        const proxyUrl = PROXY_BASE + encodeURIComponent(fetchUrl);
        const proxyResp = await fetch(proxyUrl, {
          headers: { 'Accept': 'image/*' }
        });
        if (!proxyResp.ok) {
          console.warn(`[OCR] 이미지 다운로드 실패: ${fetchUrl} (${proxyResp.status})`);
          continue;
        }
        contentType = proxyResp.headers.get('Content-Type') || '';
        arrayBuffer = await proxyResp.arrayBuffer();
      }

      // 응답이 HTML인 경우 스킵 (핫링크 방지/에러 페이지)
      if (contentType.includes('text/html') || contentType.includes('text/plain')) {
        console.warn(`[OCR] 이미지 아닌 응답 스킵: ${fetchUrl} (${contentType})`);
        continue;
      }

      // 매직 바이트 검증: 실제 이미지 데이터인지 확인
      if (!isValidImage(arrayBuffer)) {
        console.warn(`[OCR] 유효하지 않은 이미지 데이터 스킵: ${fetchUrl}`);
        continue;
      }

      if (arrayBuffer.byteLength > MAX_SIZE_BYTES) {
        console.warn(`[OCR] 이미지 크기 초과: ${fetchUrl} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
        continue;
      }

      // MIME 타입 결정: 매직 바이트 기반
      const header = new Uint8Array(arrayBuffer).slice(0, 4);
      let mimeType = 'image/jpeg';
      if (header[0] === 0x89 && header[1] === 0x50) mimeType = 'image/png';
      else if (header[0] === 0x47 && header[1] === 0x49) mimeType = 'image/gif';
      else if (header[0] === 0x52 && header[1] === 0x49) mimeType = 'image/webp';
      else if (header[0] === 0x42 && header[1] === 0x4D) mimeType = 'image/bmp';

      // ArrayBuffer → base64 변환
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      results.push({ base64, mimeType, src: fetchUrl });
    } catch (e) {
      console.warn(`[OCR] 이미지 처리 오류: ${img.src}`, e.message);
    }
  }

  return results;
}

/** OCR 프롬프트 텍스트 생성 */
function buildOcrPrompt() {
  return `이 이미지는 한국어 채용공고입니다. 이미지에 포함된 모든 텍스트를 정확하게 추출해주세요.

## 규칙
1. 이미지에 보이는 텍스트를 100% 그대로 추출하세요. 글자 하나 변경/추가/삭제 금지.
2. 환각(hallucination) 절대 금지 — 이미지에 없는 텍스트를 만들지 마세요.
3. 표(테이블)가 있으면 <table> HTML로 구조화하세요.
4. 목록이 있으면 <ul><li> 또는 번호 체계를 보존하세요.
5. 제목, 소제목, 본문을 구분하여 <h1>, <h2>, <h3>, <p> 태그를 사용하세요.
6. 원문의 기호(○, ●, ■, ※, ▶ 등)를 그대로 보존하세요.
7. 여러 이미지가 있으면 순서대로 하나의 연속된 문서로 추출하세요.

## 출력 형식
순수 HTML로 출력하세요. 마크다운 코드 블록(\`\`\`) 없이 <h1>부터 바로 시작.
텍스트가 없는 장식 이미지 부분은 무시하세요.`;
}

/**
 * OCR용 멀티모달 메시지 배열 생성 (Claude 네이티브 포맷)
 * @param {Array<{base64: string, mimeType: string}>} images
 * @returns {Array<{role: string, content: Array}>}
 */
function buildOcrMessages(images) {
  const content = [];

  for (const img of images) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.base64 }
    });
  }

  content.push({ type: 'text', text: buildOcrPrompt() });

  return [{ role: 'user', content }];
}

/**
 * OCR 텍스트를 접근성 숨김 div로 래핑
 * @param {string} ocrText - OCR로 추출된 HTML 텍스트
 * @returns {string}
 */
function buildAccessibleDiv(ocrText) {
  return `<div id="incruit-accessible-text" style="display:none">\n${ocrText}\nDesigned by Incruit Corporation.\n</div>`;
}

/** HTML에서 텍스트만 추출 (글자수 계산용) */
function stripHtmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

/**
 * 이미지 전용 콘텐츠 OCR 변환 오케스트레이터
 * @param {string} sourceHtml - 원본 HTML (img 태그 포함)
 * @param {object} detection - detectImageOnlyContent() 결과
 * @param {object} progress - createProgressMessage() 객체
 * @returns {Promise<{ocrHtml: string, ocrText: string, accessibleDiv: string, imageCount: number}>}
 */
async function performOcrConversion(sourceHtml, detection, progress) {
  // Step A: 이미지 감지 결과 표시
  const sOcr1 = progress.addStep(`이미지 전용 콘텐츠 감지 — ${detection.images.length}개 발견`, '🖼️');
  await sleep(150);
  progress.completeStep(sOcr1, `텍스트 ${detection.textLength}자 · 이미지 ${detection.images.length}개`);

  // Step B: 이미지 다운로드
  const sOcr2 = progress.addStep('이미지 다운로드', '⬇️');
  const base64Images = await extractImagesAsBase64(detection.images);

  if (base64Images.length === 0) {
    progress.failStep(sOcr2, '이미지 다운로드 실패');
    throw new Error('이미지를 다운로드할 수 없습니다. CORS 프록시를 확인해주세요.');
  }

  const totalSize = base64Images.reduce((sum, img) => sum + img.base64.length * 0.75, 0);
  progress.completeStep(sOcr2, `${base64Images.length}개 · ${(totalSize / 1024 / 1024).toFixed(1)}MB`);

  // Step C: Vision API OCR
  const sOcr3 = progress.addStep('OCR 텍스트 추출 (Vision API)', '👁️');
  const apiStart = Date.now();

  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - apiStart) / 1000);
    progress.updateStep(sOcr3, `OCR 텍스트 추출 중... ${elapsed}초`, '👁️');
  }, 1000);

  let ocrResponse;
  try {
    const ocrMessages = buildOcrMessages(base64Images);
    ocrResponse = await callAI(ocrMessages);
  } finally {
    clearInterval(timerInterval);
  }

  const ocrHtml = extractHtmlFromResponse(ocrResponse);
  const ocrText = stripHtmlToText(ocrHtml);

  if (!ocrText || ocrText.length < 10) {
    progress.failStep(sOcr3, 'OCR 텍스트 추출 실패');
    throw new Error('OCR에서 텍스트를 추출하지 못했습니다. 이미지가 텍스트를 포함하고 있는지 확인해주세요.');
  }

  progress.completeStep(sOcr3, `${ocrText.length.toLocaleString()}자 추출 · ${Math.floor((Date.now() - apiStart) / 1000)}초`);

  // Step D: 접근성 태그 생성
  const sOcr4 = progress.addStep('접근성 태그 생성', '♿');
  await sleep(100);
  const accessibleDiv = buildAccessibleDiv(ocrHtml);
  progress.completeStep(sOcr4, `접근성 텍스트 ${ocrHtml.length.toLocaleString()}자`);

  return { ocrHtml, ocrText, accessibleDiv, imageCount: base64Images.length };
}

// ============================================
// AI API
// ============================================
async function callAI(promptOrMessages, onChunk) {
  // 문자열이면 기존처럼 메시지 래핑, 배열이면 멀티모달 메시지로 직접 사용
  const messages = Array.isArray(promptOrMessages)
    ? promptOrMessages
    : [{ role: 'user', content: promptOrMessages }];

  // 이어쓰기 상태 초기화
  state.lastContinuations = 0;

  // AbortController 생성 (중지 버튼용)
  state._aiAbortController = new AbortController();

  // 첫 호출 (스트리밍 콜백 전달)
  let result = await callProvider(messages, state._aiAbortController.signal, onChunk);
  let fullContent = result.content;

  // 자동 이어쓰기 (잘림 감지 시 최대 2회 재시도)
  const MAX_CONTINUATIONS = 2;

  while (result.truncated && state.lastContinuations < MAX_CONTINUATIONS) {
    state.lastContinuations++;
    console.log(`응답이 잘려서 자동 이어쓰기 중... (${state.lastContinuations}/${MAX_CONTINUATIONS})`);

    messages.push({ role: 'assistant', content: fullContent });
    messages.push({ role: 'user', content: '응답이 잘렸습니다. 잘린 마지막 태그/텍스트 바로 뒤부터 정확히 이어서 작성하세요. 이미 출력한 내용은 절대 반복하지 마세요. HTML 태그가 열려있으면 닫지 말고 내용부터 이어쓰세요.' });

    // 이어쓰기 시 onChunk에 기존 content 합산하여 전달
    result = await callProvider(messages, state._aiAbortController.signal, onChunk ? (text) => onChunk(fullContent + text) : null);
    fullContent += result.content;
  }

  if (result.truncated) {
    state.lastContinuations = -1; // -1 = 여전히 잘림
    console.warn('최대 이어쓰기 횟수 초과 — 응답이 여전히 잘려 있을 수 있습니다.');
  }

  state._aiAbortController = null;
  return fullContent;
}

function callProvider(messages, signal, onChunk) {
  switch (state.provider) {
    case 'openai':
      return callOpenAI(messages, signal, onChunk);
    case 'claude':
      return callClaude(messages, signal, onChunk);
    case 'gemini':
      return callGemini(messages, signal, onChunk);
    default:
      throw new Error('AI 서비스가 설정되지 않았습니다.');
  }
}

async function callOpenAI(messages, signal, onChunk) {
  const model = state.model || 'gpt-4o';
  const useStream = typeof onChunk === 'function';

  // 멀티모달 메시지 변환: Claude 정규화 형식 → OpenAI 형식
  const formattedMessages = messages.map(msg => {
    if (typeof msg.content === 'string' || !Array.isArray(msg.content)) return msg;
    return {
      role: msg.role,
      content: msg.content.map(part => {
        if (part.type === 'text') return part;
        if (part.type === 'image' && part.source) {
          return {
            type: 'image_url',
            image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` }
          };
        }
        return part;
      })
    };
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.apiKey}`
    },
    body: JSON.stringify({
      model, messages: formattedMessages, temperature: 0, max_tokens: 16384,
      ...(useStream && { stream: true })
    }),
    signal
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API 오류');
  }

  // 비스트리밍 모드
  if (!useStream) {
    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      truncated: data.choices[0].finish_reason === 'length'
    };
  }

  // 스트리밍 모드 (SSE)
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let finishReason = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          content += delta;
          onChunk(content);
        }
        if (parsed.choices?.[0]?.finish_reason) {
          finishReason = parsed.choices[0].finish_reason;
        }
      } catch {}
    }
  }

  return { content, truncated: finishReason === 'length' };
}

async function callClaude(messages, signal, onChunk) {
  const model = state.model || 'claude-opus-4-6';
  const targetUrl = 'https://api.anthropic.com/v1/messages';
  const useStream = typeof onChunk === 'function';

  // Anthropic API는 브라우저 CORS를 차단하므로 프록시 경유
  const proxyBase = '/proxy/?url=';
  let url, headers;

  try {
    const healthResp = await fetch(PROXY_HEALTH_URL, { signal: AbortSignal.timeout(2000) });
    if (healthResp.ok) {
      url = proxyBase + encodeURIComponent(targetUrl);
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      };
    } else {
      throw new Error('proxy not ok');
    }
  } catch {
    url = targetUrl;
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': state.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model, max_tokens: 8192, temperature: 0, messages,
      ...(useStream && { stream: true })
    }),
    signal
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    let msg = error.error?.message || error.message || '';
    if (!msg && error.body) {
      try { msg = JSON.parse(error.body).error?.message || error.body; } catch { msg = error.body; }
    }
    if (!msg) msg = `API 오류 (${response.status})`;
    if (response.status === 401 || msg.includes('invalid x-api-key') || msg.includes('authentication')) {
      throw new Error('Claude API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.');
    }
    if (response.status === 0 || msg.includes('Failed to fetch')) {
      throw new Error('Claude API 연결 실패. CORS 프록시를 실행해주세요: python3 cors-proxy.py');
    }
    throw new Error(msg);
  }

  // 비스트리밍 모드
  if (!useStream) {
    const data = await response.json();
    return { content: data.content[0].text, truncated: data.stop_reason === 'max_tokens' };
  }

  // 스트리밍 모드 (SSE)
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let stopReason = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const parsed = JSON.parse(line.slice(6));
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          content += parsed.delta.text;
          onChunk(content);
        }
        if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
          stopReason = parsed.delta.stop_reason;
        }
      } catch {}
    }
  }

  return { content, truncated: stopReason === 'max_tokens' };
}

async function callGemini(messages, signal, onChunk) {
  const model = state.model || 'gemini-3-pro-preview';
  const useStream = typeof onChunk === 'function';
  const endpoint = useStream ? 'streamGenerateContent' : 'generateContent';
  const streamParam = useStream ? '&alt=sse' : '';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${state.apiKey}${streamParam}`;

  const contents = messages.map(msg => {
    const role = msg.role === 'assistant' ? 'model' : 'user';

    // 문자열 content → 기존 텍스트 전용 동작
    if (typeof msg.content === 'string') {
      return { role, parts: [{ text: msg.content }] };
    }

    // 배열 content → 멀티모달 (이미지 + 텍스트) parts 변환
    if (Array.isArray(msg.content)) {
      const parts = msg.content.map(part => {
        if (part.type === 'text') return { text: part.text };
        if (part.type === 'image' && part.source) {
          return { inline_data: { mime_type: part.source.media_type, data: part.source.data } };
        }
        return { text: JSON.stringify(part) };
      });
      return { role, parts };
    }

    return { role, parts: [{ text: String(msg.content) }] };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0, maxOutputTokens: 65536 }
    }),
    signal
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'API 오류');
  }

  // 비스트리밍 모드
  if (!useStream) {
    const data = await response.json();
    return {
      content: data.candidates[0].content.parts[0].text,
      truncated: data.candidates[0].finishReason === 'MAX_TOKENS'
    };
  }

  // 스트리밍 모드 (SSE)
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let content = '';
  let finishReason = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const parsed = JSON.parse(line.slice(6));
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          content += text;
          onChunk(content);
        }
        if (parsed.candidates?.[0]?.finishReason) {
          finishReason = parsed.candidates[0].finishReason;
        }
      } catch {}
    }
  }

  return { content, truncated: finishReason === 'MAX_TOKENS' };
}

// ============================================
// Chat
// ============================================
async function handleSendMessage() {
  const content = elements.chatInput.value.trim();
  if (!content || state.isLoading) return;

  elements.chatInput.value = '';
  addMessage('user', content);

  state.isLoading = true;
  elements.btnSend.disabled = true;

  try {
    // Build context with current state
    const contextPrompt = `현재 상태:
- 채용공고 번호: ${state.jobNumber || '미입력'}
- 템플릿: ${templates[state.template].name}
- 원문 입력됨: ${state.sourceContent ? '예' : '아니오'}
- 변환 완료됨: ${state.convertedHtml ? '예' : '아니오'}

사용자 요청: ${content}`;

    const response = await callAI(contextPrompt);
    addMessage('assistant', response);
  } catch (error) {
    addMessage('assistant', `오류: ${error.message}`);
  } finally {
    state.isLoading = false;
    elements.btnSend.disabled = false;
  }
}

// ============================================
// 공고 요약 & 핵심 역량 분석
// ============================================

async function summarizeJobPosting() {
  const sourceText = state.originalSource?.raw || state.sourceContent || elements.sourceEditor?.innerHTML;
  if (!sourceText || sourceText === '<br>') {
    addMessage('assistant', '요약할 채용공고가 아직 없네요. 원문을 먼저 입력해주세요.');
    return;
  }
  if (!state.apiKey) {
    addMessage('assistant', 'AI API 키가 필요합니다. 설정에서 API 키를 먼저 입력해주세요.');
    return;
  }

  const _statsId = recordTaskStart('chat');
  const progress = createProgressMessage();

  try {
    const s1 = progress.addStep('채용공고 분석 중', '📋');
    await sleep(150);
    const textLen = stripHtmlToText(sourceText).length;
    progress.completeStep(s1, `${textLen.toLocaleString()}자 분석`);

    const s2 = progress.addStep('AI 요약 생성 중', '🤖');
    const prompt = buildSummaryPrompt(sourceText);
    const response = await callAI(prompt);
    progress.completeStep(s2, '요약 완료');

    progress.addResult(formatMessage(response));
    progress.finalize('공고 요약 완료');
    recordTaskEnd(_statsId, '공고 요약');
  } catch (error) {
    recordTaskEnd(_statsId, '오류');
    const activeStep = document.querySelector(`#${progress.id} .progress-step.active`);
    if (activeStep) progress.failStep(Number(activeStep.dataset.stepId), error.message);
    progress.addResult(`<span class="text-red-400">⚠ 오류: ${escapeHtml(error.message)}</span>`);
    progress.finalize(`오류: ${error.message}`);
  }
}

async function analyzeKeyCompetencies() {
  const sourceText = state.originalSource?.raw || state.sourceContent || elements.sourceEditor?.innerHTML;
  if (!sourceText || sourceText === '<br>') {
    addMessage('assistant', '분석할 채용공고가 아직 없네요. 원문을 먼저 입력해주세요.');
    return;
  }
  if (!state.apiKey) {
    addMessage('assistant', 'AI API 키가 필요합니다. 설정에서 API 키를 먼저 입력해주세요.');
    return;
  }

  const _statsId = recordTaskStart('chat');
  const progress = createProgressMessage();

  try {
    const s1 = progress.addStep('직무 분석 중', '🔍');
    await sleep(150);
    progress.completeStep(s1, '공고 내용 파싱 완료');

    const s2 = progress.addStep('핵심 역량 추출 중', '🎯');
    const prompt = buildCompetencyPrompt(sourceText);
    const response = await callAI(prompt);
    progress.completeStep(s2, '역량 분석 완료');

    // JSON 블록 파싱 시도 → state에 저장 (나중에 매칭/추천용)
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const competencyData = JSON.parse(jsonMatch[1]);
        state._lastCompetencyAnalysis = competencyData;
        localStorage.setItem('last_competency_analysis', JSON.stringify({
          data: competencyData,
          timestamp: Date.now(),
          wsName: getWorkspaceName(getActiveId())
        }));
      }
    } catch { /* JSON 파싱 실패 — 무시 */ }

    // JSON 블록 제거 후 보기 좋게 표시
    const displayText = response.replace(/```json[\s\S]*?```/g, '').trim();
    progress.addResult(formatMessage(displayText));
    progress.finalize('핵심 역량 분석 완료');
    recordTaskEnd(_statsId, '핵심 역량 분석');
  } catch (error) {
    recordTaskEnd(_statsId, '오류');
    const activeStep = document.querySelector(`#${progress.id} .progress-step.active`);
    if (activeStep) progress.failStep(Number(activeStep.dataset.stepId), error.message);
    progress.addResult(`<span class="text-red-400">⚠ 오류: ${escapeHtml(error.message)}</span>`);
    progress.finalize(`오류: ${error.message}`);
  }
}

function buildSummaryPrompt(sourceText) {
  const cleanText = sanitizeForAI(sourceText);
  return `다음 채용공고를 간결하게 요약해주세요.

## 요약 형식
다음 항목을 빠짐없이 정리하되, 공고에 없는 항목은 생략하세요:

**기업 정보**: 회사명, 업종, 규모
**모집 직무**: 포지션명, 부서
**주요 업무**: 핵심 업무 3-5가지 (한 줄씩)
**자격 요건**: 필수/우대 조건
**근무 조건**: 근무지, 근무형태, 급여
**전형 절차**: 채용 프로세스
**접수 기간**: 마감일

## 요약 규칙
- 원문에 있는 정보만 사용 (추측/추가 금지)
- 간결하되 핵심 수치(연차, 급여, 날짜)는 정확히 기재
- 한국어로 작성
- 마크다운 형식 사용

## 채용공고 원문
${cleanText}`;
}

function buildCompetencyPrompt(sourceText) {
  const cleanText = sanitizeForAI(sourceText);
  return `다음 채용공고를 분석하여 이 직무에 필요한 **핵심 역량**과 **회사 컬처**를 구조화해주세요.

## 분석 관점
1. **직무 역량 (Job Competencies)**: 이 포지션을 수행하는 데 필요한 기술적·실무적 역량
2. **소프트 스킬 (Soft Skills)**: 대인관계, 커뮤니케이션, 리더십 등 범용 역량
3. **회사 컬처 (Company Culture)**: 공고 문체, 키워드, 복리후생 등에서 유추되는 조직 문화
4. **성장 포인트**: 이 직무를 통해 얻을 수 있는 경력 성장 방향

## 출력 형식

### 보기 좋은 요약 (마크다운)
각 역량을 카테고리별로 정리하고, 중요도를 ★로 표시(1-3개)하세요.

**직무 핵심 역량**
- ★★★ 역량명: 한 줄 설명 (공고 근거)
- ★★ 역량명: 한 줄 설명
...

**소프트 스킬**
- ★★★ 역량명: 한 줄 설명
...

**회사 컬처 키워드**
공고에서 읽히는 조직 문화 3-5가지를 한 줄씩 설명

**성장 포인트**
이 직무에서 기대할 수 있는 경력 성장 방향 2-3가지

### 구조화 데이터 (매칭용 JSON)
분석 결과를 아래 형식의 JSON으로도 출력하세요:
\`\`\`json
{
  "position": "포지션명",
  "company": "회사명",
  "industry": "업종",
  "competencies": {
    "technical": [
      { "name": "역량명", "importance": 3, "description": "설명", "keywords": ["키워드1", "키워드2"] }
    ],
    "soft": [
      { "name": "역량명", "importance": 2, "description": "설명", "keywords": ["키워드1"] }
    ]
  },
  "culture": {
    "keywords": ["키워드1", "키워드2"],
    "traits": ["특성1", "특성2"],
    "workStyle": "근무 스타일 한 줄 요약"
  },
  "growth": ["성장 방향 1", "성장 방향 2"]
}
\`\`\`

## 분석 규칙
- 공고 원문에 근거한 분석만 (추측 최소화)
- importance: 3=필수, 2=우대, 1=있으면 좋음
- 한국어로 작성
- 역량은 구체적으로 (예: "Python" > "프로그래밍", "B2B SaaS 영업" > "영업")

## 채용공고 원문
${cleanText}`;
}

function handleQuickAction(action) {
  // Use shared AI input if available, fallback to old panel
  const chatInput = document.getElementById('ai-chat-input') || elements.chatInput;

  switch (action) {
    case 'url-analyze':
      if (chatInput) {
        chatInput.focus();
        chatInput.placeholder = '분석할 채용공고 URL을 입력하세요 (여러 개 가능)...';
        addMessage('assistant', '채용공고 URL을 입력해주세요.\n다양한 채용 플랫폼 URL을 지원합니다.\n여러 URL을 한 번에 입력할 수도 있습니다.');
      }
      break;

    case 'add-keyvisual': {
      // 키비주얼 탭으로 전환
      const kvTab = document.querySelector('.settings-tab[data-settings-tab="keyvisual"]');
      if (kvTab) kvTab.click();

      // 원문에서 자동 채움
      const filled = tryAutoFillKvFromSource();

      // 프리셋 자동 선택
      const presetKey = detectBestPreset();
      applyKvPreset(presetKey);
      document.querySelectorAll('.kv-preset-card').forEach(b => b.classList.remove('active'));
      const presetBtn = document.querySelector(`[data-preset="${presetKey}"]`);
      if (presetBtn) presetBtn.classList.add('active');

      // 미리보기만 뷰로 전환
      setTimeout(() => {
        const previewBtn = document.querySelector('[data-view="preview"]');
        if (previewBtn) previewBtn.click();
      }, 100);

      addMessage('assistant', filled
        ? `키비주얼 탭으로 이동했습니다. 텍스트와 이미지를 설정하여 키비주얼을 만들어보세요.\n→ "${KV_PRESETS[presetKey]?.name}" 프리셋이 자동 적용되었습니다.`
        : '키비주얼 탭으로 이동했습니다. 텍스트와 이미지를 설정하여 키비주얼을 만들어보세요.');
      break;
    }

    case 'convert':
      handleConvert();
      break;

    case 'verify': {
      if (!state.convertedHtml) {
        addMessage('assistant', '검증할 변환 결과가 없습니다. 먼저 변환을 진행해주세요.');
        return;
      }
      // 원문 소스 가져오기 (sourceEditor는 변환 후 덮어씌워지므로 originalSource 사용)
      const originalHtml = state.originalSource?.raw || state.sourceContent;
      if (!originalHtml) {
        addMessage('assistant', '원문 소스를 찾을 수 없습니다. 원문을 다시 입력해주세요.');
        return;
      }

      // 로컬 검증 — 순수 텍스트 기준 비교 (토큰 소비 없음)
      const verifyResult = verifyConversion(originalHtml, state.convertedHtml);
      addMessage('assistant', '');

      // 카드 UI + Diff 뷰 첨부
      const lastMsg = state.messages[state.messages.length - 1];
      lastMsg.verifyResult = verifyResult;

      const verifyDiff = computeTextDiff(originalHtml, state.convertedHtml);
      if (verifyDiff && verifyDiff.changeCount > 0) {
        lastMsg.diffHtml = verifyDiff.html;
        lastMsg.diffAddCount = verifyDiff.addCount;
        lastMsg.diffDelCount = verifyDiff.delCount;
        lastMsg.diffOpen = verifyResult.grade !== 'A';
      }
      renderSharedAiMessages();
      break;
    }

    case 'summarize':
      summarizeJobPosting();
      break;

    case 'competencies':
      analyzeKeyCompetencies();
      break;
  }
}

// Trigger send on the shared AI panel
function triggerAiSend() {
  const sendBtn = document.getElementById('ai-chat-send');
  if (sendBtn) {
    sendBtn.click();
  } else {
    handleSendMessage();
  }
}

function addMessage(role, content) {
  state.messages.push({ role, content, timestamp: new Date() });
  renderMessages();
  saveSession();
}

// ============================================
// Progress Message System (Claude Code 스타일)
// ============================================

/**
 * 인크루트 아이콘과 함께 단계별 진행 과정을 실시간 표시
 * Claude Code의 "Read file → Analyze → Write" 스타일
 */
function createProgressMessage() {
  const id = 'progress-' + Date.now();
  const steps = [];
  let startTime = Date.now();

  const container = document.getElementById('ai-messages');
  if (!container) return null;

  // 진행 메시지 DOM 생성
  const msgEl = document.createElement('div');
  msgEl.className = 'ai-msg ai-msg-assistant';
  msgEl.id = id;
  msgEl.innerHTML = `
    <div class="ai-msg-avatar progress-avatar">
      <img src="https://www.incruit.com/favicon.ico" alt="incruit" class="progress-incruit-icon" onerror="this.style.display='none'; this.parentElement.textContent='✸';">
    </div>
    <div class="ai-msg-content progress-content">
      <div class="progress-steps"></div>
    </div>
  `;
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;

  const stepsEl = msgEl.querySelector('.progress-steps');

  return {
    id,
    /** 새 단계 추가 (스피너 표시) */
    addStep(label, icon = '') {
      const stepId = steps.length;
      const stepEl = document.createElement('div');
      stepEl.className = 'progress-step active';
      stepEl.dataset.stepId = stepId;
      stepEl.innerHTML = `
        <span class="step-indicator spinning"></span>
        <span class="step-text">${icon ? icon + ' ' : ''}${label}</span>
      `;
      stepsEl.appendChild(stepEl);
      steps.push({ label, icon, el: stepEl, start: Date.now() });
      container.scrollTop = container.scrollHeight;
      return stepId;
    },

    /** 단계 완료 표시 (설명 문구 형태) */
    completeStep(stepId, resultText = '') {
      const step = steps[stepId];
      if (!step) return;
      const elapsed = Date.now() - step.start;
      step.el.classList.remove('active');
      step.el.classList.add('completed');
      const indicator = step.el.querySelector('.step-indicator');
      indicator.classList.remove('spinning');
      indicator.innerHTML = '✓';
      const timeStr = elapsed > 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`;
      // 라벨 + 결과 + 시간을 한 줄 설명 문구로 결합
      const textEl = step.el.querySelector('.step-text');
      const icon = step.icon ? step.icon + ' ' : '';
      if (resultText) {
        textEl.innerHTML = `${icon}${step.label} — ${resultText} <span class="step-time">(${timeStr})</span>`;
      } else {
        textEl.innerHTML = `${icon}${step.label} <span class="step-time">(${timeStr})</span>`;
      }
      container.scrollTop = container.scrollHeight;
    },

    /** 단계 텍스트 실시간 업데이트 (진행 중일 때) */
    updateStep(stepId, newLabel, newIcon) {
      const step = steps[stepId];
      if (!step) return;
      const textEl = step.el.querySelector('.step-text');
      const icon = newIcon || step.icon;
      textEl.innerHTML = `${icon ? icon + ' ' : ''}${newLabel}`;
      container.scrollTop = container.scrollHeight;
    },

    /** 스트리밍 미리보기 표시/업데이트 */
    setStreamingPreview(text) {
      let previewEl = msgEl.querySelector('.streaming-preview');
      if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.className = 'streaming-preview';
        msgEl.querySelector('.progress-content').appendChild(previewEl);
      }
      const maxLen = 300;
      const display = text.length > maxLen ? '…' + text.slice(-maxLen) : text;
      previewEl.textContent = display;
      container.scrollTop = container.scrollHeight;
    },

    /** 스트리밍 미리보기 제거 */
    clearStreamingPreview() {
      const el = msgEl.querySelector('.streaming-preview');
      if (el) el.remove();
    },

    /** 단계 실패 표시 */
    failStep(stepId, errorText = '') {
      const step = steps[stepId];
      if (!step) return;
      step.el.classList.remove('active');
      step.el.classList.add('failed');
      const indicator = step.el.querySelector('.step-indicator');
      indicator.classList.remove('spinning');
      indicator.innerHTML = '✗';
      const textEl = step.el.querySelector('.step-text');
      const icon = step.icon ? step.icon + ' ' : '';
      if (errorText) {
        textEl.innerHTML = `${icon}${step.label} — <span class="step-error-text">${errorText}</span>`;
      }
      container.scrollTop = container.scrollHeight;
    },

    /** 진행 메시지 하단에 최종 결과 추가 */
    addResult(html) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const resultEl = document.createElement('div');
      resultEl.className = 'progress-result';
      resultEl.innerHTML = `${html}<div class="progress-total-time">총 ${elapsed}초</div>`;
      msgEl.querySelector('.progress-content').appendChild(resultEl);
      container.scrollTop = container.scrollHeight;
    },

    /** 진행 메시지를 state.messages에 기록 (히스토리 보존) */
    finalize(summaryText) {
      state.messages.push({
        role: 'assistant',
        content: summaryText,
        timestamp: new Date(),
        isProgress: true
      });
    }
  };
}

function renderMessages() {
  // Render to original chat panel (if visible)
  if (elements.chatMessages) {
    if (state.messages.length === 0) {
      if (state.apiKey && state.provider) {
        const providerName = AI_PROVIDERS[state.provider]?.name || state.provider;
        elements.chatMessages.innerHTML = `
          <div class="text-center text-gray-500 text-sm py-4">
            <p>안녕하세요! 채용공고 키비주얼을 만들어드릴게요.</p>
            <p class="text-xs mt-1 text-green-400">✓ ${providerName} 연결됨 — 기업명과 채용 정보를 알려주세요.</p>
          </div>
        `;
      } else {
        elements.chatMessages.innerHTML = `
          <div class="text-center text-gray-500 text-sm py-4">
            <p>안녕하세요! 채용공고 키비주얼을 만들어드릴게요.</p>
            <p class="text-xs mt-1">설정(⚙️)에서 API 키를 입력하세요</p>
          </div>
        `;
      }
    } else {
      elements.chatMessages.innerHTML = state.messages.map(msg => `
        <div class="chat-message ${msg.role}">
          <div class="message-content">${formatMessage(msg.content)}</div>
        </div>
      `).join('');
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
  }

  // Render to shared AI assistant panel
  renderSharedAiMessages();
}

// ============================================
// 원문 ↔ 변환 비교 뷰 (build 412)
// ============================================
function _extractCompareBlocks(html) {
  if (!html) return [];
  const div = document.createElement('div');
  div.innerHTML = html;
  // 리프 블록만 수집 (컨테이너는 제외)
  const selector = 'p, li, td, th, h1, h2, h3, h4, h5, h6, div';
  const blocks = [];
  div.querySelectorAll(selector).forEach(el => {
    const hasBlockChild = el.querySelector('p, div, li, td, th, table, ul, ol, h1, h2, h3, h4, h5, h6');
    if (hasBlockChild) return;
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 2) return;
    const norm = enhancedNormalize(text);
    if (!norm) return;
    blocks.push({
      html: el.outerHTML,
      text,
      norm,
      tag: el.tagName.toLowerCase(),
      bigrams: _makeBigrams(norm)
    });
  });
  return blocks;
}
function _makeBigrams(s) {
  const out = new Set();
  for (let i = 0; i < s.length - 1; i++) out.add(s.substring(i, i + 2));
  return out;
}
function _bigramSim(a, b) {
  if (!a.size || !b.size) return 0;
  let match = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  small.forEach(g => { if (large.has(g)) match++; });
  return match / small.size;
}

window.openSourceCompareView = function() {
  const primary = state.originalSource?.raw || elements.sourceEditor?.innerHTML || '';
  const pdfBaseline = state.originalSource?.pdfHtml || '';
  const convertedHtml = state.convertedHtml || '';
  if (!primary || !convertedHtml) {
    showToast('비교할 원문 또는 변환문이 없습니다.');
    return;
  }

  const srcBlocks = _extractCompareBlocks(primary);
  const srcPrimaryCount = srcBlocks.length;
  // PDF 원문이 있으면 baseline으로 추가 — "추가" 오탐을 줄이기 위함
  // (HWP+PDF 비전 변환 시 PDF에서 살린 내용이 "추가"로 잘못 표시되던 문제 해결)
  if (pdfBaseline) {
    const pdfBlocks = _extractCompareBlocks(pdfBaseline);
    pdfBlocks.forEach(pb => {
      // 이미 HWP에 있는 거면 중복 제외
      if (!srcBlocks.some(sb => _bigramSim(sb.bigrams, pb.bigrams) >= 0.9)) {
        srcBlocks.push({ ...pb, source: 'pdf' });
      }
    });
  }
  const cnvBlocks = _extractCompareBlocks(convertedHtml);

  // 1:1 그리디 매칭 — 각 소스 블록당 가장 유사한 미사용 변환 블록 1개만 소비
  // build 414: 이전 버전은 소비 없이 매칭 → 다수 소스가 동일 변환을 가리켜 나머지 변환 블록이
  // 모두 "추가"로 오탐되던 문제 수정
  const consumed = new Set();
  const srcStatus = srcBlocks.map((s, si) => {
    let best = { sim: 0, idx: -1 };
    for (let i = 0; i < cnvBlocks.length; i++) {
      if (consumed.has(i)) continue;
      const sim = _bigramSim(s.bigrams, cnvBlocks[i].bigrams);
      if (sim > best.sim) best = { sim, idx: i };
      if (best.sim >= 0.98) break; // 거의 완전 일치면 조기 종료
    }
    // 55% 이상일 때만 consumption 처리 (그 아래는 missing 판정이라 매칭 소비 X)
    if (best.idx >= 0 && best.sim >= 0.55) consumed.add(best.idx);
    let status = 'missing';
    if (best.sim >= 0.90) status = 'preserved';
    else if (best.sim >= 0.55) status = 'modified';
    else best.idx = -1;
    return { ...best, status };
  });
  // 변환 블록 상태: 소비된 것만 preserved/modified, 나머지는 added
  const cnvMatchedBy = new Array(cnvBlocks.length).fill(null);
  srcStatus.forEach((st, si) => {
    if (st.idx >= 0) cnvMatchedBy[st.idx] = { srcIdx: si, sim: st.sim };
  });
  const cnvStatus = cnvBlocks.map((c, ci) => {
    const m = cnvMatchedBy[ci];
    if (!m) return { status: 'added', srcIdx: -1, sim: 0 };
    if (m.sim >= 0.90) return { status: 'preserved', srcIdx: m.srcIdx, sim: m.sim };
    return { status: 'modified', srcIdx: m.srcIdx, sim: m.sim };
  });

  // 카운트
  const counts = { preserved: 0, modified: 0, missing: 0, added: 0 };
  srcStatus.forEach(s => counts[s.status]++);
  cnvStatus.forEach(c => { if (c.status === 'added') counts.added++; });

  // 기존 모달 제거
  document.getElementById('compare-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'compare-modal';
  modal.className = 'compare-modal';
  modal.innerHTML = `
    <div class="compare-dialog">
      <div class="compare-header">
        <h3>원문 ↔ 변환 비교 <span class="compare-hint">(클릭: 반대쪽 이동 · 더블클릭: 실제 HTML 위치)</span></h3>
        <button class="compare-dock-btn" title="도킹 — 모달을 우측 반쪽으로 축소해 미리보기와 나란히 보기">⇔ 도킹</button>
        <div class="compare-legend">
          <span class="compare-legend-item compare-chip-preserved">● 보존 ${counts.preserved}</span>
          <span class="compare-legend-item compare-chip-modified">● 수정 ${counts.modified}</span>
          <span class="compare-legend-item compare-chip-missing">● 누락 ${counts.missing}</span>
          <span class="compare-legend-item compare-chip-added">● 추가 ${counts.added}</span>
        </div>
        <button class="compare-close" title="닫기">×</button>
      </div>
      <div class="compare-body">
        <div class="compare-col" style="flex: 1 1 0; min-width: 200px;">
          <div class="compare-col-title">원문 (${srcBlocks.length} 블록${pdfBaseline ? ` · HWP ${srcPrimaryCount} + PDF ${srcBlocks.length - srcPrimaryCount}` : ''})</div>
          <div class="compare-col-content" id="compare-src">
            ${srcBlocks.map((b, i) => {
              const st = srcStatus[i];
              const tooltip = st.status === 'missing'
                ? '변환 결과에서 일치 항목 없음'
                : `유사도 ${Math.round(st.sim*100)}% (${st.status === 'preserved' ? '보존' : '수정'})`;
              const originLabel = b.source === 'pdf' ? '<span class="compare-origin-pdf" title="PDF 원문">PDF</span>' : '';
              return `<div class="compare-block compare-block-${st.status}" data-src-idx="${i}" data-match-idx="${st.idx}" title="${tooltip}"><span class="compare-block-tag">${b.tag}</span>${originLabel}${escapeHtml(b.text.substring(0, 200))}${b.text.length > 200 ? '…' : ''}</div>`;
            }).join('')}
          </div>
        </div>
        <div class="compare-splitter" title="드래그하여 너비 조절"></div>
        <div class="compare-col" style="flex: 1 1 0; min-width: 200px;">
          <div class="compare-col-title">변환문 (${cnvBlocks.length} 블록)</div>
          <div class="compare-col-content" id="compare-cnv">
            ${cnvBlocks.map((b, i) => {
              const st = cnvStatus[i];
              const tooltip = st.status === 'added'
                ? '원문에 해당 블록 없음 (추가됨)'
                : `유사도 ${Math.round(st.sim*100)}% (${st.status === 'preserved' ? '보존' : '수정'})`;
              return `<div class="compare-block compare-block-${st.status}" data-cnv-idx="${i}" data-match-idx="${st.srcIdx}" title="${tooltip}"><span class="compare-block-tag">${b.tag}</span>${escapeHtml(b.text.substring(0, 200))}${b.text.length > 200 ? '…' : ''}</div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // 닫기
  const close = () => modal.remove();
  modal.querySelector('.compare-close').onclick = close;
  modal.onclick = (e) => {
    // 도킹 모드에서는 overlay 배경 클릭 무시 (뒤쪽 문서와 상호작용)
    if (e.target === modal && !modal.classList.contains('docked')) close();
  };
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  // 도킹 토글 — 우측 반쪽 패널 ↔ 전체 모달
  const dockBtn = modal.querySelector('.compare-dock-btn');
  if (dockBtn) {
    dockBtn.onclick = () => {
      const docked = modal.classList.toggle('docked');
      dockBtn.textContent = docked ? '⇔ 전체' : '⇔ 도킹';
      dockBtn.title = docked
        ? '전체 모드로 복귀'
        : '도킹 — 모달을 우측 반쪽으로 축소해 미리보기와 나란히 보기';
    };
  }

  // 컬럼 너비 드래그 리사이즈
  const splitter = modal.querySelector('.compare-splitter');
  const compareBody = modal.querySelector('.compare-body');
  const leftCol = compareBody.children[0];
  const rightCol = compareBody.children[2];
  if (splitter) {
    let dragging = false;
    splitter.addEventListener('mousedown', (e) => {
      dragging = true;
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = compareBody.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const totalW = rect.width - 6; // splitter 폭 고려
      const leftW = Math.max(200, Math.min(totalW - 200, x));
      const rightW = totalW - leftW;
      leftCol.style.flex = `0 0 ${leftW}px`;
      rightCol.style.flex = `0 0 ${rightW}px`;
    });
    document.addEventListener('mouseup', () => {
      if (dragging) { dragging = false; document.body.style.cursor = ''; }
    });
  }

  // 블록 클릭 → 반대쪽 매칭 블록 스크롤/하이라이트
  // 더블클릭 → 모달 닫고 실제 에디터/미리보기에서 해당 위치 찾아 하이라이트
  const srcCol = modal.querySelector('#compare-src');
  const cnvCol = modal.querySelector('#compare-cnv');
  const jumpHighlight = (el) => {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('compare-flash');
    setTimeout(() => el.classList.remove('compare-flash'), 1500);
  };
  srcCol.addEventListener('click', (e) => {
    const block = e.target.closest('.compare-block');
    if (!block) return;
    const srcIdx = parseInt(block.dataset.srcIdx);
    const matchIdx = block.dataset.matchIdx;
    // 모달 내부 반대쪽 이동
    if (matchIdx !== undefined && matchIdx !== '-1') {
      jumpHighlight(cnvCol.querySelector(`[data-cnv-idx="${matchIdx}"]`));
    }
    // 도킹 모드면 실제 에디터/미리보기도 동시 이동 (build 416)
    if (modal.classList.contains('docked')) {
      if (!isNaN(srcIdx)) _compareJumpSilent(srcBlocks[srcIdx].text, 'src');
      if (matchIdx !== undefined && matchIdx !== '-1') {
        _compareJumpSilent(cnvBlocks[parseInt(matchIdx)].text, 'cnv');
      }
    }
  });
  cnvCol.addEventListener('click', (e) => {
    const block = e.target.closest('.compare-block');
    if (!block) return;
    const cnvIdx = parseInt(block.dataset.cnvIdx);
    const matchIdx = block.dataset.matchIdx;
    if (matchIdx !== undefined && matchIdx !== '-1') {
      jumpHighlight(srcCol.querySelector(`[data-src-idx="${matchIdx}"]`));
    }
    if (modal.classList.contains('docked')) {
      if (!isNaN(cnvIdx)) _compareJumpSilent(cnvBlocks[cnvIdx].text, 'cnv');
      if (matchIdx !== undefined && matchIdx !== '-1') {
        _compareJumpSilent(srcBlocks[parseInt(matchIdx)].text, 'src');
      }
    }
  });
  // 더블클릭 → 실제 HTML 위치로 이동
  srcCol.addEventListener('dblclick', (e) => {
    const block = e.target.closest('.compare-block');
    if (!block) return;
    const idx = parseInt(block.dataset.srcIdx);
    if (isNaN(idx)) return;
    _compareJumpToHtml(srcBlocks[idx].text, 'src');
  });
  cnvCol.addEventListener('dblclick', (e) => {
    const block = e.target.closest('.compare-block');
    if (!block) return;
    const idx = parseInt(block.dataset.cnvIdx);
    if (isNaN(idx)) return;
    _compareJumpToHtml(cnvBlocks[idx].text, 'cnv');
  });
};

// 도킹 모드에서 클릭 시 조용한 스크롤 (모달·탭 유지, 하이라이트만) (build 416)
function _compareJumpSilent(text, side) {
  const target = side === 'src'
    ? (document.getElementById('original-viewer') || document.getElementById('source-editor'))
    : (document.getElementById('template-preview') || document.getElementById('preview-content'));
  if (!target) return;
  target.querySelectorAll('.compare-highlight').forEach(el => el.classList.remove('compare-highlight'));
  const needle = text.substring(0, 40).trim();
  if (!needle) return;
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let found = null;
  while (walker.nextNode()) {
    if ((walker.currentNode.textContent || '').includes(needle)) { found = walker.currentNode; break; }
  }
  if (!found) return;
  const elTarget = found.parentElement;
  if (!elTarget) return;
  elTarget.classList.add('compare-highlight');
  elTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => elTarget.classList.remove('compare-highlight'), 2500);
}

// 비교 뷰에서 더블클릭 시 실제 에디터/미리보기로 이동 (build 414)
function _compareJumpToHtml(text, side) {
  // build 415: 도킹 모드면 모달 유지 (뒤쪽에 미리보기 보임)
  const modal = document.getElementById('compare-modal');
  const isDocked = modal?.classList.contains('docked');
  if (!isDocked) modal?.remove();
  const target = side === 'src'
    ? (document.getElementById('original-viewer') || document.getElementById('source-editor'))
    : (document.getElementById('template-preview') || document.getElementById('preview-content'));
  if (!target) { showToast('이동 대상 영역을 찾을 수 없습니다.'); return; }

  // 소스면 원문 탭으로, 아니면 미리보기 탭으로 활성화
  try {
    if (side === 'src') setViewAndActivateTab?.('source');
    else setViewAndActivateTab?.('preview');
  } catch (_) {}

  // 기존 하이라이트 제거
  target.querySelectorAll('.compare-highlight').forEach(el => el.classList.remove('compare-highlight'));

  // 앞 40자 기준 검색
  const needle = text.substring(0, 40).trim();
  if (!needle) return;
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  let found = null;
  while (walker.nextNode()) {
    if ((walker.currentNode.textContent || '').includes(needle)) { found = walker.currentNode; break; }
  }
  if (!found) { showToast('해당 블록 위치를 찾지 못했습니다: "' + needle.substring(0, 20) + '"'); return; }
  const elTarget = found.parentElement;
  if (!elTarget) return;
  elTarget.classList.add('compare-highlight');
  elTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => elTarget.classList.remove('compare-highlight'), 3500);
}

function buildVerifyCard(r) {
  const gradeLabel = { A: '우수', B: '양호', C: '주의', F: '실패' }[r.grade] || '';
  const { tables, lists, headings } = r.structureCheck;

  const statClass = (src, conv) => src !== conv ? 'verify-stat-warn' : 'verify-stat-ok';
  const statVal   = (src, conv) => src === conv ? String(src) : `${src}→${conv}`;

  // 경고 섹션 — 항목별 클릭 카드
  let warningsHtml = '';
  const warnItems = [];

  function makeVerifyItems(texts, type) {
    return texts.map(t => {
      const escaped = escapeHtml(t);
      const encoded = escapeHtml(JSON.stringify(t));
      return `<button class="verify-item-btn" onclick="verifyScrollToText(${encoded},'${type}')" title="미리보기에서 위치 찾기">
        <span class="verify-item-text">${escaped}</span>
        <span class="verify-item-arrow">↗</span>
      </button>`;
    }).join('');
  }

  if (r.missingTexts.length > 0) {
    const items = makeVerifyItems(r.missingTexts.slice(0, 10), 'missing');
    const more = r.missingTexts.length > 10 ? `<div class="verify-item-more">...외 ${r.missingTexts.length - 10}건</div>` : '';
    warnItems.push(`<div class="verify-warn-section"><div class="verify-warn-title">⚠ 누락 의심 ${r.missingTexts.length}건 <span class="verify-hint">클릭하면 미리보기에서 위치 확인</span></div><div class="verify-item-list">${items}${more}</div></div>`);
  }
  if (r.criticalData.missing.length > 0) {
    const items = makeVerifyItems(r.criticalData.missing, 'critical');
    warnItems.push(`<div class="verify-warn-section"><div class="verify-warn-title verify-warn-title-F">✕ 핵심 데이터 누락 ${r.criticalData.missing.length}건 <span class="verify-hint">클릭하면 미리보기에서 위치 확인</span></div><div class="verify-item-list">${items}</div></div>`);
  }
  if (r.tableDetail.cellsMissing.length > 0) {
    const items = makeVerifyItems(r.tableDetail.cellsMissing.slice(0, 10), 'cell');
    const more = r.tableDetail.cellsMissing.length > 10 ? `<div class="verify-item-more">...외 ${r.tableDetail.cellsMissing.length - 10}건</div>` : '';
    warnItems.push(`<div class="verify-warn-section"><div class="verify-warn-title">⚠ 테이블 셀 누락 ${r.tableDetail.cellsMissing.length}건 <span class="verify-hint">클릭하면 미리보기에서 위치 확인</span></div><div class="verify-item-list">${items}${more}</div></div>`);
  }
  if (warnItems.length > 0) {
    warningsHtml = `<div class="verify-warnings">${warnItems.join('')}</div>`;
  }

  // 최종 판정
  const verdictMap = {
    A: ['verify-verdict-pass', '✓ 검증 통과 — 원문이 정확히 보존되었습니다.'],
    B: ['verify-verdict-ok',   '✓ 검증 통과 — 사소한 차이가 있지만 허용 범위입니다.'],
    C: ['verify-verdict-warn', '⚠ 주의 필요 — 일부 내용이 변경되었을 수 있습니다.'],
    F: ['verify-verdict-fail', '✕ 검증 실패 — 원문이 보존되지 않았습니다. 재변환을 권장합니다.'],
  };
  const [verdictClass, verdictText] = verdictMap[r.grade] || ['', ''];
  // build 417: 하단에도 "원문 비교" 버튼 중복 배치 (긴 카드 스크롤 시 접근성 확보)
  const compareBtnBottom = `<button class="verify-compare-btn verify-compare-btn-bottom" onclick="openSourceCompareView()" title="원문과 변환문을 블록 단위로 나란히 비교">원문 비교 보기 →</button>`;

  return `<div class="verify-card">
  <div class="verify-card-header">
    <div class="verify-grade verify-grade-${r.grade}">${r.grade}</div>
    <div class="verify-header-info">
      <div class="verify-header-title">원문 보존 검증 결과</div>
    </div>
    <button class="verify-compare-btn" onclick="openSourceCompareView()" title="원문과 변환문을 블록 단위로 나란히 비교">원문 비교</button>
  </div>
  ${warningsHtml}
  <div class="verify-score-bar-wrap">
    <div class="verify-score-bar">
      <div class="verify-score-fill verify-score-fill-${r.grade}" style="width:${r.score}%"></div>
    </div>
  </div>
  <div class="verify-stats">
    <div class="verify-stat">
      <span class="verify-stat-value">${r.textMatch}%</span>
      <span class="verify-stat-label">텍스트 일치율</span>
    </div>
    <div class="verify-stat ${statClass(tables.source, tables.converted)}">
      <span class="verify-stat-value">${statVal(tables.source, tables.converted)}</span>
      <span class="verify-stat-label">테이블</span>
    </div>
    <div class="verify-stat ${statClass(lists.source, lists.converted)}">
      <span class="verify-stat-value">${statVal(lists.source, lists.converted)}</span>
      <span class="verify-stat-label">리스트</span>
    </div>
    <div class="verify-stat ${statClass(headings.source, headings.converted)}">
      <span class="verify-stat-value">${statVal(headings.source, headings.converted)}</span>
      <span class="verify-stat-label">제목</span>
    </div>
  </div>
  <div class="verify-header-sub" style="text-align:center; margin-top:6px; font-size:13px; color:var(--text-secondary);">${gradeLabel} · ${r.score}점 / 100점</div>
  <div class="verify-verdict ${verdictClass}">${verdictText}</div>
  <div class="verify-card-footer">${compareBtnBottom}</div>
</div>`;
}

// 검증 카드 항목 클릭 → 미리보기에서 텍스트 위치 찾아 하이라이트
window.verifyScrollToText = function(rawText, type) {
  // rawText: 표시 텍스트 (80자 truncated 포함), type: 'missing'|'critical'|'cell'
  // critical 타입은 "전화번호: 02-xxx" 형태 → 콜론 뒤 실제 값만 추출
  let searchText = rawText.endsWith('...') ? rawText.slice(0, -3) : rawText;
  if (type === 'critical') {
    const colonIdx = searchText.indexOf(': ');
    if (colonIdx !== -1) searchText = searchText.slice(colonIdx + 2);
  }
  // 미리보기 탭으로 전환
  setViewAndActivateTab('preview');

  const previewEl = document.getElementById('preview-content');
  if (!previewEl) return;

  // 기존 하이라이트 제거
  previewEl.querySelectorAll('.verify-highlight').forEach(el => {
    el.replaceWith(document.createTextNode(el.textContent));
  });

  // 텍스트 노드에서 검색 (정규식 이스케이프)
  const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped.slice(0, 30), 'i'); // 앞 30자로 검색

  let found = null;
  function searchNode(node) {
    if (found) return;
    if (node.nodeType === Node.TEXT_NODE) {
      if (regex.test(node.textContent)) {
        const span = document.createElement('mark');
        span.className = 'verify-highlight';
        span.textContent = node.textContent;
        node.parentNode.replaceChild(span, node);
        found = span;
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT','STYLE'].includes(node.tagName)) {
      Array.from(node.childNodes).forEach(searchNode);
    }
  }
  searchNode(previewEl);

  if (found) {
    found.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 2.5초 후 하이라이트 제거
    setTimeout(() => {
      if (found.parentNode) found.replaceWith(document.createTextNode(found.textContent));
    }, 2500);
  } else {
    // 미리보기에서 못 찾음 (누락된 경우) → 원문 탭으로 전환해서 알림
    setViewAndActivateTab('original');
    const originalEl = document.getElementById('original-viewer');
    if (originalEl) {
      const notice = document.createElement('div');
      notice.className = 'verify-not-found-notice';
      notice.textContent = `"${searchText.slice(0, 40)}" — 변환 결과에 없는 내용입니다`;
      originalEl.prepend(notice);
      setTimeout(() => notice.remove(), 3000);
    }
  }
};

function renderSharedAiMessages() {
  const container = document.getElementById('ai-messages');
  if (!container) return;

  if (state.messages.length === 0) {
    const isConnected = !!(state.apiKey && state.provider);
    container.innerHTML = `
      <div class="ai-welcome">
        <div class="ai-welcome-logo">✸</div>
        <p>${isConnected
          ? '안녕하세요! 채용공고 키비주얼을 만들어드릴게요.<br>기업명과 채용 정보를 알려주세요.'
          : '설정(⚙️)에서 API 키를 입력하세요'}</p>
      </div>`;
    return;
  }

  container.innerHTML = state.messages.map(msg => {
    if (msg.role === 'user') {
      return `<div class="ai-msg ai-msg-user">
        <div class="ai-msg-bubble">${formatMessage(msg.content)}</div>
      </div>`;
    } else {
      const formatted = formatMessage(msg.content);
      // 변환 완료 메시지에 복사 버튼 자동 추가
      const hasCopyable = state.convertedHtml && /HTML.*변환\s*완료|HTML이\s*생성/.test(msg.content);
      const copyBtnsHtml = hasCopyable ? buildCopyButtons(!!document.getElementById('kv-preview-card')) : '';
      // 검증 카드
      const verifyCardHtml = msg.verifyResult ? buildVerifyCard(msg.verifyResult) : '';
      // 차이점 하이라이트 섹션
      let diffSection = '';
      if (msg.diffHtml) {
        const openAttr = msg.diffOpen ? ' open' : '';
        const labels = [];
        if (msg.diffAddCount > 0) labels.push(`<span class="diff-label-add">+${msg.diffAddCount} 추가</span>`);
        if (msg.diffDelCount > 0) labels.push(`<span class="diff-label-del">-${msg.diffDelCount} 삭제</span>`);
        diffSection = `<details class="diff-details"${openAttr}><summary class="diff-toggle">차이점 보기 ${labels.join(' ')}</summary><div class="diff-container">${msg.diffHtml}</div></details>`;
      }
      return `<div class="ai-msg ai-msg-assistant">
        <div class="ai-msg-avatar">✸</div>
        <div class="ai-msg-content">${formatted}${verifyCardHtml}${diffSection}${copyBtnsHtml}</div>
      </div>`;
    }
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function formatMessage(content) {
  let f = content;
  // Code blocks — 복사 버튼 포함 wrapper로 감싸기
  f = f.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escaped = escapeHtml(code.trim());
    const langLabel = lang ? ` data-lang="${lang}"` : '';
    return `<div class="ai-code-block-wrapper"${langLabel}>` +
      `<button class="copy-btn-code" onclick="copyCodeBlock(this)" title="복사">📋</button>` +
      `<pre class="ai-code-block"><code>${escaped}</code></pre>` +
      `</div>`;
  });
  // Inline code
  f = f.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
  // Bold
  f = f.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic (single *)
  f = f.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Newlines
  f = f.replace(/\n/g, '<br>');
  return f;
}

/** 코드 블록 내 복사 */
/** KV 채팅 이미지 클릭 → 배경 즉시 적용 */
window.applyKvChatImage = function(el) {
  const url = el.dataset.kvImgUrl;
  if (!url) return;
  state.kv.bgImageUrl = url;
  const urlInput = document.getElementById('kv-bg-url');
  if (urlInput) urlInput.value = url;
  renderKvPreview();
  document.querySelectorAll('.kv-chat-img-item').forEach(item => {
    item.classList.toggle('kv-chat-img-selected', item === el);
  });
};

window.copyCodeBlock = function(btn) {
  const wrapper = btn.closest('.ai-code-block-wrapper');
  const code = wrapper?.querySelector('code')?.textContent || '';
  copyToClipboard(code, btn);
};

/** 지정된 타입의 데이터를 복사 */
window.copyResultData = async function(btn, type) {
  // F 등급 게이트: html/preview 복사는 변환 결과 외부 반출이므로 차단 대상
  if (type === 'html' || type === 'preview') {
    if (!await checkVerifyGate('복사')) return;
  }
  let text = '';
  if (type === 'html') {
    // generateFullHtml()과 동일한 출력 (코드뷰 / 다운로드와 일치)
    text = generateFullHtml();
  } else if (type === 'preview') {
    // 미리보기용 전체 HTML (head+body)
    const iframe = document.getElementById('preview-frame');
    if (iframe?.srcdoc) {
      text = iframe.srcdoc;
    } else {
      text = state.convertedHtml || '';
    }
  } else if (type === 'kv') {
    // 키비주얼 HTML
    text = generateKvHtml() || '';
  } else if (type === 'response') {
    // 마지막 AI 응답 원문
    const lastMsg = [...state.messages].reverse().find(m => m.role === 'assistant' && !m.isProgress);
    text = lastMsg?.content || '';
  }
  copyToClipboard(text, btn);
};

/** 클립보드에 복사하고 버튼 피드백 표시 */
function copyToClipboard(text, btn) {
  if (!text) return;
  const origHtml = btn.innerHTML;
  const showCopied = () => {
    btn.classList.add('copied');
    btn.innerHTML = '✓ 복사됨';
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = origHtml; }, 1500);
  };
  navigator.clipboard.writeText(text).then(showCopied).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showCopied();
  });
}

/** Vision 이어서 변환 — state._visionContinueFunc에 저장된 클로저 호출 */
window.continueVisionConversion = function() {
  if (state._visionContinueFunc) state._visionContinueFunc();
};

/** 이어서 변환 버튼 HTML 생성 */
function buildContinueButton(processedPages, totalPages) {
  const nextEnd = Math.min(totalPages, processedPages + 10);
  return `<button class="copy-btn" onclick="window.continueVisionConversion()" style="background:var(--accent-color);">▶ 이어서 변환 (${processedPages + 1}~${nextEnd}p)</button>`;
}

/** 변환 완료 시 복사 버튼 그룹 HTML 생성 */
function buildCopyButtons(hasKv) {
  const svgCopy = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
  let html = '<div class="copy-btn-group">';
  html += `<button class="copy-btn" onclick="copyResultData(this,'html')">${svgCopy} HTML 복사</button>`;
  html += `<button class="copy-btn" onclick="copyResultData(this,'preview')">${svgCopy} 미리보기 전체 복사</button>`;
  if (hasKv) {
    html += `<button class="copy-btn" onclick="copyResultData(this,'kv')">${svgCopy} 키비주얼 복사</button>`;
  }
  html += '</div>';
  return html;
}

/** 키비주얼 HTML 문자열 생성 (복사용) */
function generateKvHtml() {
  const card = document.getElementById('kv-preview-card');
  if (!card) return '';
  const fontLinks = getKvFontLinks();
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>키비주얼 - ${escapeHtml(state.kv.jobCode || '')}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
${fontLinks}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; background: #f3f4f6; font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif; }
${typeof getKvCardStyles === 'function' ? getKvCardStyles() : ''}
</style>
</head>
<body>
${card.outerHTML}
</body>
</html>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================
// Utility Functions
// ============================================
function updateKeyVisualPreview() {
  if (state.keyVisualUrl) {
    elements.keyVisualPreview.classList.remove('hidden');
    elements.keyVisualPreview.querySelector('img').src = state.keyVisualUrl;
  } else {
    elements.keyVisualPreview.classList.add('hidden');
  }
}

function updateCssVariables() {
  const bulletMap = {
    check: '"✓"',
    circle: '"●"',
    arrow: '"▶"',
    star: '"★"',
    dash: '"—"',
    square: '"■"',
    ssquare: '"▪"',
    chevron: '""',
    number: '""',
    hangul: '""'
  };

  document.documentElement.style.setProperty('--incruit-primary', state.colorPrimary);
  document.documentElement.style.setProperty('--incruit-secondary', state.colorSecondary);
  document.documentElement.style.setProperty('--incruit-accent', state.colorAccent);
  document.documentElement.style.setProperty('--bullet-style', bulletMap[state.bulletStyle] || '"✓"');

  // 셰브론 불릿용 data-bullet 속성 설정
  const previewEl = document.querySelector('.jobpost-preview');
  if (previewEl) {
    previewEl.setAttribute('data-bullet', state.bulletStyle);
  }

  // 타이틀 스타일 + 테이블 헤더 동적 CSS를 미리보기에 주입
  let dynamicStyleEl = document.getElementById('incruit-dynamic-styles');
  if (!dynamicStyleEl) {
    dynamicStyleEl = document.createElement('style');
    dynamicStyleEl.id = 'incruit-dynamic-styles';
    document.head.appendChild(dynamicStyleEl);
  }
  dynamicStyleEl.textContent = buildIncruitDynamicStyles();
}

/**
 * tools/main.js의 update() 방식 — 미리보기 DOM의 sec_title_wrap을 직접 즉시 갱신
 */
function refreshTitleStyleInPreview() {
  const preview = elements.previewContent;
  if (!preview) return;

  const secTitleWraps = preview.querySelectorAll('.sec_title_wrap');
  if (!secTitleWraps.length) {
    // 아직 섹션이 없으면 전체 재렌더링으로 폴백
    if (state.convertedHtml) updatePreview();
    return;
  }

  let secNum = 0;
  secTitleWraps.forEach(wrap => {
    secNum++;
    const iconWrap = wrap.querySelector('.sec_title_icon');

    if (state.titleStyle === 'iconNumber') {
      wrap.className = 'sec_title_wrap title_bg title_num';
      if (iconWrap) iconWrap.innerHTML = `<span class="num${parseInt(state.iconNumber) || 1}"></span>`;
      const h3 = wrap.querySelector('h3');
      if (h3) h3.textContent = h3.textContent.trim().replace(/^[\d.\s]+/, '');

    } else if (state.titleStyle === 'iconBg') {
      wrap.className = 'sec_title_wrap title_bg';
      if (iconWrap) iconWrap.innerHTML = `<span class="bul_${state.iconBg}"></span>`;
      const h3 = wrap.querySelector('h3');
      if (h3) h3.textContent = h3.textContent.trim().replace(/^[\d.\s]+/, '');

    } else if (state.titleStyle === 'titleSub') {
      wrap.className = `sec_title_wrap c_title_wrap c_title_${state.titleSub}`;
      if (iconWrap) iconWrap.innerHTML = '';
      const parentSec = wrap.closest('.sec_wrap');
      const secClass = parentSec ? Array.from(parentSec.classList).find(c => /^sec\d+$/.test(c)) : null;
      const num = secClass ? secClass.replace('sec', '') : secNum;
      const h3 = wrap.querySelector('h3');
      if (h3) {
        const cleanText = h3.textContent.trim().replace(/^[\d.\s]+/, '');
        if (['4', '6'].includes(state.titleSub)) {
          h3.innerHTML = `<span class="title_num">${num}</span>${cleanText}`;
        } else {
          h3.textContent = `${num}. ${cleanText}`;
        }
      }
    }
  });

  updateCssVariables();
  updateHtmlCode();
}

/**
 * 타이틀 스타일 서브옵션 동적 렌더링
 */
function renderTitleStyleOptions() {
  const container = document.getElementById('title-style-options');
  if (!container) return;
  container.innerHTML = '';

  const createColorRow = (label, stateKey) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 mt-1';
    row.innerHTML = `
      <label class="text-xs text-gray-400 w-16 shrink-0">${label}</label>
      <input type="color" value="${state[stateKey]}" class="color-swatch w-6 h-6">
      <input type="text" value="${state[stateKey]}" class="color-hex flex-1" maxlength="7" spellcheck="false">
    `;
    const swatch = row.querySelector('input[type="color"]');
    const hex = row.querySelector('input[type="text"]');
    swatch.addEventListener('input', (e) => {
      state[stateKey] = e.target.value;
      hex.value = e.target.value;
      updateCssVariables();
      refreshTitleStyleInPreview();
      updateHtmlCode();
    });
    hex.addEventListener('input', (e) => {
      const v = e.target.value;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        state[stateKey] = v;
        swatch.value = v;
        updateCssVariables();
        refreshTitleStyleInPreview();
        updateHtmlCode();
      }
    });
    return row;
  };

  const createSelect = (label, stateKey, options) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 mt-1';
    row.innerHTML = `<label class="text-xs text-gray-400 w-16 shrink-0">${label}</label>`;
    const select = document.createElement('select');
    select.className = 'setting-input flex-1 text-xs py-1';
    options.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });
    select.value = state[stateKey];
    select.addEventListener('change', (e) => {
      state[stateKey] = e.target.value;
      // titleSub 변경 시에만 서브옵션 재렌더링 (색상 항목이 sub별로 다름)
      // iconNumber/iconBg는 재렌더링 불필요 — SELECT 파괴 후 재생성 시 상태 동기화 오류 방지
      if (stateKey === 'titleSub') renderTitleStyleOptions();
      refreshTitleStyleInPreview();
    });
    row.appendChild(select);
    return row;
  };

  if (state.titleStyle === 'iconNumber') {
    // 썸네일 그리드 피커 (num1 ~ num12)
    const pickerRow = document.createElement('div');
    pickerRow.className = 'flex items-start gap-2 mt-1';
    pickerRow.innerHTML = `<label class="text-xs text-gray-400 w-16 shrink-0 pt-1">숫자</label>`;

    const picker = document.createElement('div');
    picker.className = 'icon-bg-picker';

    const grid = document.createElement('div');
    grid.id = 'templwrap_v3';
    grid.className = 'icon-bg-grid num-picker-grid';

    Array.from({ length: 12 }, (_, i) => i + 1).forEach(n => {
      const cell = document.createElement('div');
      cell.className = 'icon-bg-cell' + (state.iconNumber === String(n) ? ' active' : '');
      cell.dataset.val = n;
      cell.innerHTML = `
        <div class="icon-bg-thumb title_bg title_num">
          <span class="sec_title_icon"><span class="num${n}"></span></span>
        </div>
        <span class="icon-bg-num">${n}</span>`;
      cell.addEventListener('click', () => {
        state.iconNumber = String(n);
        grid.querySelectorAll('.icon-bg-cell').forEach(c => c.classList.remove('active'));
        cell.classList.add('active');
        refreshTitleStyleInPreview();
      });
      grid.appendChild(cell);
    });

    picker.appendChild(grid);
    pickerRow.appendChild(picker);
    container.appendChild(pickerRow);
    container.appendChild(createColorRow('아이콘색', 'colorPrimary'));
  } else if (state.titleStyle === 'iconBg') {
    // 썸네일 그리드 피커 (bul_1 ~ bul_18)
    const pickerRow = document.createElement('div');
    pickerRow.className = 'flex items-start gap-2 mt-1';
    pickerRow.innerHTML = `<label class="text-xs text-gray-400 w-16 shrink-0 pt-1">BG</label>`;

    const picker = document.createElement('div');
    picker.className = 'icon-bg-picker';

    const grid = document.createElement('div');
    grid.className = 'icon-bg-grid';

    // #templwrap_v3를 래퍼로 사용 → CDN CSS의 bul_ 규칙이 이 스코프에도 적용됨
    grid.id = 'templwrap_v3';
    grid.className = 'icon-bg-grid bul-picker-grid';

    Array.from({ length: 18 }, (_, i) => i + 1).forEach(n => {
      const cell = document.createElement('div');
      cell.className = 'icon-bg-cell' + (state.iconBg === String(n) ? ' active' : '');
      cell.dataset.val = n;
      cell.innerHTML = `
        <div class="icon-bg-thumb title_bg">
          <span class="sec_title_icon"><span class="bul_${n}"></span></span>
        </div>
        <span class="icon-bg-num">${n}</span>`;
      cell.addEventListener('click', () => {
        state.iconBg = String(n);
        grid.querySelectorAll('.icon-bg-cell').forEach(c => c.classList.remove('active'));
        cell.classList.add('active');
        refreshTitleStyleInPreview();
      });
      grid.appendChild(cell);
    });

    picker.appendChild(grid);
    pickerRow.appendChild(picker);
    container.appendChild(pickerRow);
    container.appendChild(createColorRow('아이콘색', 'colorPrimary'));
  } else if (state.titleStyle === 'titleSub') {
    // 썸네일 그리드 피커 (c_title_1 ~ c_title_8), 2열 4행
    const pickerRow = document.createElement('div');
    pickerRow.className = 'flex items-start gap-2 mt-1';
    pickerRow.innerHTML = `<label class="text-xs text-gray-400 w-16 shrink-0 pt-1">스타일</label>`;

    const picker = document.createElement('div');
    picker.className = 'icon-bg-picker';

    const grid = document.createElement('div');
    grid.id = 'templwrap_v3';
    grid.className = 'title-sub-grid';

    Array.from({ length: 8 }, (_, i) => i + 1).forEach(n => {
      const cell = document.createElement('div');
      cell.className = 'icon-bg-cell' + (state.titleSub === String(n) ? ' active' : '');
      cell.dataset.val = n;
      // c_title_4, 6은 title_num 포함
      const h3Inner = ['4', '6'].includes(String(n))
        ? `<span class="title_num">1</span>타이틀`
        : '타이틀';
      cell.innerHTML = `
        <div class="title-sub-thumb c_title_wrap c_title_${n}">
          <h3>${h3Inner}</h3>
        </div>
        <span class="icon-bg-num">${n}</span>`;
      cell.addEventListener('click', () => {
        state.titleSub = String(n);
        renderTitleStyleOptions();
        refreshTitleStyleInPreview();
      });
      grid.appendChild(cell);
    });

    picker.appendChild(grid);
    pickerRow.appendChild(picker);
    container.appendChild(pickerRow);

    // titleSub 종류별 세부 색상 옵션
    const sub = state.titleSub;
    if (sub === '1') {
      container.appendChild(createColorRow('글자색', 'subTitleTextColor'));
      container.appendChild(createColorRow('라인색', 'subTitleLineColor'));
    } else if (sub === '2') {
      container.appendChild(createColorRow('배경색', 'subTitleBgColor'));
      container.appendChild(createColorRow('글자색', 'subTitleTextColor'));
      container.appendChild(createColorRow('라인색', 'subTitleLineColor'));
    } else if (sub === '3') {
      container.appendChild(createColorRow('글자색', 'subTitleTextColor'));
      container.appendChild(createColorRow('라인색', 'subTitleLineColor'));
      container.appendChild(createColorRow('그림자', 'subTitleShadowColor'));
    } else if (sub === '4') {
      container.appendChild(createColorRow('숫자배경', 'subTitleBgColor'));
      container.appendChild(createColorRow('숫자색', 'subTitleTextColor'));
    } else if (sub === '5') {
      container.appendChild(createColorRow('배경색', 'subTitleBgColor'));
      container.appendChild(createColorRow('글자색', 'subTitleTextColor'));
    } else if (sub === '6') {
      container.appendChild(createColorRow('숫자배경', 'subTitleBgColor'));
      container.appendChild(createColorRow('라인색', 'subTitleLineColor'));
    } else if (sub === '7') {
      container.appendChild(createColorRow('배경색', 'subTitleBgColor'));
    } else if (sub === '8') {
      container.appendChild(createColorRow('배경색', 'subTitleBgColor'));
      container.appendChild(createColorRow('볼릿색', 'subTitleLineColor'));
    }
  }
}

function updateAiStatus() {
  const isConnected = !!(state.apiKey && state.provider);
  const providerConfig = isConnected ? AI_PROVIDERS[state.provider] : null;
  const providerName = providerConfig?.name || state.provider;
  const providerColor = providerConfig?.color || '#888';

  // Update old chat panel (if elements exist - panel is hidden but DOM remains)
  if (elements.statusText) {
    if (isConnected) {
      elements.statusText.innerHTML = `
        <span class="status-dot connected"></span>
        <span class="provider-badge ${state.provider}" style="border: 1px solid ${providerColor}40;">
          ${providerName}
        </span>
        <span class="text-green-400">연결됨</span>
      `;
    } else {
      elements.statusText.innerHTML = `
        <span class="status-dot disconnected"></span>
        <span class="text-yellow-400">AI 연결 필요</span>
      `;
    }
  }
  if (elements.btnSend) {
    elements.btnSend.disabled = !isConnected;
  }

  // Refresh welcome message to reflect connection state
  if (state.messages.length === 0) {
    renderMessages();
  }

  // Update shared AI status dot
  document.querySelectorAll('.kv-ai-status-dot').forEach(dot => {
    dot.classList.toggle('connected', isConnected);
    dot.title = isConnected ? `${providerName} 연결됨` : 'API 키 필요';
  });

  // Enable/disable shared AI send buttons
  document.querySelectorAll('.kv-ai-send-btn').forEach(btn => {
    btn.disabled = !isConnected;
  });
}

// Deprecated model ID → current model ID migration map
const MODEL_MIGRATION_MAP = {
  'gpt-4': 'gpt-4o',
  'gpt-3.5-turbo': 'gpt-4o-mini',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-5-20250929',
  'claude-3-sonnet-20240229': 'claude-sonnet-4-5-20250929',
  'claude-3-opus-20240229': 'claude-opus-4-6',
  'claude-3-haiku-20240307': 'claude-haiku-4-5-20251001',
  'gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini-1.5-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-flash'
};

function loadSettings() {
  // Load saved provider and model
  state.provider = localStorage.getItem('ai_provider') || 'openai';
  state.model = localStorage.getItem('ai_model') || '';
  state.apiKey = localStorage.getItem('ai_api_key') || '';

  // Migrate deprecated model IDs to current ones
  if (state.model && MODEL_MIGRATION_MAP[state.model]) {
    const oldModel = state.model;
    state.model = MODEL_MIGRATION_MAP[state.model];
    localStorage.setItem('ai_model', state.model);
    console.info(`[AI] 모델 자동 마이그레이션: ${oldModel} → ${state.model}`);
  }

  // Try to load provider-specific API key
  if (!state.apiKey && state.provider) {
    state.apiKey = localStorage.getItem(`ai_api_key_${state.provider}`) || '';
  }
}

// ── F 등급 다운로드·복사 차단 게이트 (Step 14.6) ──────────────────────────

/**
 * 검증 게이트 — F 등급 변환 결과에 대한 외부 배포 액션을 차단한다.
 * @param {string} actionLabel — 모달 문구에 표시할 액션명 (예: "다운로드", "복사")
 * @returns {Promise<boolean>} — true면 액션 진행, false면 차단
 */
async function checkVerifyGate(actionLabel) {
  // 뒤에서부터 verifyResult 가진 첫 메시지 찾기 (채팅 인터리빙 대응)
  const msgWithVerify = [...state.messages].reverse().find(m => m.verifyResult);

  // 검증 결과 없으면 통과 (변환 전 또는 검증 미실행 케이스)
  if (!msgWithVerify) return true;

  const verify = msgWithVerify.verifyResult;

  // F가 아니면 통과
  if (verify.grade !== 'F') return true;

  // 이미 사용자가 이 변환에서 override 승인한 경우 통과
  if (msgWithVerify.verifyOverride) return true;

  // F + override 없음 → 모달 띄우고 사용자 응답 기다림
  return await showVerifyGateModal(verify, actionLabel, msgWithVerify);
}

/**
 * F 등급 게이트 모달을 표시하고 사용자 응답을 기다린다.
 * @param {Object} verify — verifyResult 객체 (grade, score, fabricatedTexts, criticalData, textMatch 등)
 * @param {string} actionLabel — 액션명 ("복사", "다운로드" 등)
 * @param {Object} msg — 해당 메시지 객체 (verifyOverride 설정 대상)
 * @returns {Promise<boolean>}
 */
function showVerifyGateModal(verify, actionLabel, msg) {
  return new Promise(resolve => {
    // 기존 모달이 남아있으면 제거
    const existing = document.getElementById('verify-gate-modal');
    if (existing) existing.remove();

    // 문제 요약 (최대 3줄)
    const issues = [];
    if (verify.fabricatedTexts && verify.fabricatedTexts.length > 0) {
      issues.push(`원문에 없는 텍스트 ${verify.fabricatedTexts.length}건 감지`);
    }
    if (verify.criticalData && verify.criticalData.missing.length > 0) {
      issues.push(`채용 핵심어 소실: ${verify.criticalData.missing.slice(0, 3).join(', ')}${verify.criticalData.missing.length > 3 ? ' 외' : ''}`);
    }
    issues.push(`텍스트 일치율 ${verify.textMatch}%`);

    const issuesHtml = issues.map(t => `<li>${escapeHtml(t)}</li>`).join('');

    // 모달 생성
    const modal = document.createElement('div');
    modal.id = 'verify-gate-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop" data-verify-gate-dismiss></div>
      <div class="modal-content" style="max-width:440px;">
        <h3 style="margin:0 0 12px;font-size:16px;color:var(--text-primary);">⚠ 검증 실패한 결과입니다</h3>
        <div style="margin-bottom:12px;padding:10px 12px;background:var(--bg-primary);border-radius:6px;border:1px solid var(--border-color);">
          <div style="font-weight:600;color:#ef4444;margin-bottom:6px;">등급: F (${verify.score}/100점)</div>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--text-secondary);line-height:1.6;">${issuesHtml}</ul>
        </div>
        <p style="margin:0 0 14px;font-size:13px;color:var(--text-secondary);line-height:1.5;">원문이 정확히 보존되지 않았습니다. 재변환을 권장합니다.</p>
        <label style="display:flex;align-items:center;gap:6px;margin-bottom:16px;font-size:13px;color:var(--text-secondary);cursor:pointer;">
          <input type="checkbox" id="verify-gate-checkbox" style="accent-color:var(--accent-color);">
          이 변환 결과에서는 다시 묻지 않기
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="verify-gate-cancel" style="padding:7px 16px;border:1px solid var(--border-color);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);cursor:pointer;font-size:13px;">취소</button>
          <button id="verify-gate-proceed" style="padding:7px 16px;border:none;border-radius:6px;background:#ef4444;color:#fff;cursor:pointer;font-size:13px;">그대로 ${escapeHtml(actionLabel)}</button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    // 정리 함수
    function cleanup(result) {
      modal.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    // 취소
    modal.querySelector('#verify-gate-cancel').addEventListener('click', () => cleanup(false));
    modal.querySelector('[data-verify-gate-dismiss]').addEventListener('click', () => cleanup(false));

    // 진행
    modal.querySelector('#verify-gate-proceed').addEventListener('click', () => {
      const checked = modal.querySelector('#verify-gate-checkbox').checked;
      if (checked) {
        msg.verifyOverride = true;
      }
      cleanup(true);
    });

    // ESC 키
    function onKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup(false);
      }
    }
    document.addEventListener('keydown', onKeydown);

    // 포커스 → 취소 버튼
    modal.querySelector('#verify-gate-cancel').focus();
  });
}

// ── / F 등급 게이트 끝 ─────────────────────────────────────────────────────

async function handleCopyHtml() {
  if (!await checkVerifyGate('복사')) return;
  const html = generateFullHtml();
  copyToClipboard(html, elements.btnCopyHtml);
}

async function handleDownload() {
  if (!await checkVerifyGate('다운로드')) return;
  const html = generateFullHtml();
  const filename = `jobpost-${state.jobNumber || 'preview'}.html`;

  // EUC-KR 인코딩 시도 (프록시 경유)
  try {
    const h = await fetch(PROXY_HEALTH_URL, { signal: AbortSignal.timeout(1000) });
    if (h.ok) {
      const resp = await fetch(ENCODE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: html
      });
      if (resp.ok) {
        const bytes = await resp.arrayBuffer();
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
    }
  } catch { /* fallback to UTF-8 */ }

  // Fallback: UTF-8로 저장 (charset 선언 수정)
  const utf8Html = html.replace('<meta charset="euc-kr">', '<meta charset="utf-8">');
  const blob = new Blob([utf8Html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 외부용 HTML 다운로드: 인크루트 외부 CSS를 인라인으로 포함하여 어디서든 동일하게 표시되도록.
 */
async function handleDownloadExternal() {
  if (!await checkVerifyGate('다운로드')) return;
  const html = generateFullHtml();
  const filename = `jobpost-${state.jobNumber || 'preview'}-external.html`;

  // 인크루트 CSS 4개 (link 태그 추출용 정규식, media CSS는 제외)
  const linkRegex = /<link[^>]*href=["'](https:\/\/c\.incru\.it\/[^"']+\.css[^"']*)["'][^>]*>\n?/gi;
  const cssUrls = [];
  let m;
  while ((m = linkRegex.exec(html)) !== null) {
    if (m[1].includes('job_post_v3_media_minify.css')) continue;
    cssUrls.push(m[1]);
  }

  showToast(`외부 CSS ${cssUrls.length}개를 인라인 변환 중...`);

  // CSS 소스 우선순위: 로컬 상대경로 → Cloudflare Pages → GitHub raw
  const cssSourceUrls = (filename) => [
    `css/${filename}`,
    `https://incruit-jobpost-editor.pages.dev/css/${filename}`,
    `https://raw.githubusercontent.com/incruit-git/incruit-jobpost-editor/main/css/${filename}`,
  ];

  const cssTexts = await Promise.all(cssUrls.map(async (url) => {
    const filename = url.split('/').pop().split('?')[0];
    for (const candidate of cssSourceUrls(filename)) {
      try {
        const resp = await fetch(candidate, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          // ArrayBuffer로 받은 후 인코딩 자동 감지 (EUC-KR / UTF-8)
          const buf = await resp.arrayBuffer();
          const headerBytes = new Uint8Array(buf.slice(0, 100));
          const headerText = new TextDecoder('ascii').decode(headerBytes);
          const isEucKr = /@charset\s+["']?euc-kr/i.test(headerText);
          let text = new TextDecoder(isEucKr ? 'euc-kr' : 'utf-8').decode(buf);
          // @charset 선언은 인라인 <style>에서 무효 → 제거
          text = text.replace(/@charset\s+["'][^"']+["'];?\s*/i, '');
          if (text && text.length > 100 && !text.startsWith('<')) {
            console.log(`[external-html] OK: ${candidate} (${text.length} chars, ${isEucKr ? 'EUC-KR' : 'UTF-8'})`);
            return `/* ${filename} */\n${text}`;
          }
        }
      } catch (e) { /* 다음 후보 시도 */ }
    }
    console.warn(`[external-html] all sources failed for: ${filename}`);
    return null;
  }));

  console.log(`[external-html] loaded ${cssTexts.filter(Boolean).length}/${cssUrls.length} CSS files`);

  const validCss = cssTexts.filter(Boolean).join('\n\n');

  // 모든 link 태그를 제거하고 단일 <style>로 교체
  let externalHtml = html.replace(linkRegex, '');
  if (validCss) {
    const styleBlock = `<style>\n${validCss}\n</style>\n`;
    // 첫 번째 <style> 태그 앞 또는 </head> 앞에 삽입
    if (externalHtml.includes('</head>')) {
      externalHtml = externalHtml.replace('</head>', `${styleBlock}</head>`);
    } else {
      externalHtml = styleBlock + externalHtml;
    }
  } else {
    showToast('외부 CSS 가져오기 실패 — 일반 다운로드로 진행');
  }

  // Minify
  const beforeSize = externalHtml.length;
  externalHtml = minifyHtml(externalHtml);
  const afterSize = externalHtml.length;

  // UTF-8로 저장
  const utf8Html = externalHtml.replace('<meta charset="euc-kr">', '<meta charset="utf-8">');
  const blob = new Blob([utf8Html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  const reduction = ((1 - afterSize / beforeSize) * 100).toFixed(1);
  showToast(`외부용 HTML 다운로드 완료 (CSS ${cssTexts.filter(Boolean).length}/${cssUrls.length}개 인라인, ${reduction}% 압축)`);
}

/**
 * HTML + CSS Minify (안전 모드)
 * - HTML: 태그 사이 공백 제거, 줄바꿈 압축
 * - CSS: 주석 제거, 불필요한 공백 제거
 * - <pre>, <textarea>, <script> 안의 내용은 보존
 */
function minifyHtml(html) {
  // 1) 보존해야 할 블록 추출 (placeholder로 교체)
  const preserved = [];
  let preserveIdx = 0;
  const preserveTag = (regex) => {
    html = html.replace(regex, (m) => {
      preserved.push(m);
      return `__PRESERVE_${preserveIdx++}__`;
    });
  };
  preserveTag(/<pre[\s\S]*?<\/pre>/gi);
  preserveTag(/<textarea[\s\S]*?<\/textarea>/gi);
  preserveTag(/<script[\s\S]*?<\/script>/gi);

  // 2) <style> 블록 내부 CSS minify
  html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
    const minified = css
      .replace(/\/\*[\s\S]*?\*\//g, '')        // 주석 제거
      .replace(/\s+/g, ' ')                     // 다중 공백 → 단일
      .replace(/\s*([{}:;,>+~])\s*/g, '$1')     // 구분자 주변 공백 제거
      .replace(/;}/g, '}')                      // 세미콜론+} → }
      .trim();
    return `<style>${minified}</style>`;
  });

  // 3) HTML 공백 압축
  html = html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')   // 주석 제거 (조건부 주석은 보존)
    .replace(/>\s+</g, '><')                    // 태그 사이 공백 제거
    .replace(/\s{2,}/g, ' ')                    // 다중 공백 → 단일
    .replace(/\n+/g, '')                        // 줄바꿈 제거
    .trim();

  // 4) 보존 블록 복원
  preserved.forEach((content, i) => {
    html = html.replace(`__PRESERVE_${i}__`, content);
  });

  return html;
}

// 외부 URL 이미지를 CORS 프록시로 fetch → DataURL 반환
// CORS를 지원하지 않는 CDN(c.incru.it 등)의 이미지 처리용 폴백
async function fetchImageViaProxy(url) {
  try {
    const proxyBase = IS_LOCAL ? 'http://localhost:8787/proxy/?url=' : '/proxy/?url=';
    const resp = await fetch(proxyBase + encodeURIComponent(url), {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

// 외부 이미지를 crossOrigin=anonymous + 캐시버스터로 재로드해서 DataURL 반환.
// CORS 미지원 서버(c.incru.it 등)는 CORS 프록시로 폴백.
// imgOrUrl: <img> 요소 또는 URL 문자열
// Promise를 타임아웃(ms)과 race — 초과 시 null resolve.
function _withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

function reloadImageWithCors(imgOrUrl) {
  const src = typeof imgOrUrl === 'string' ? imgOrUrl : (imgOrUrl.getAttribute('src') || '');
  if (!src || src.startsWith('data:')) return Promise.resolve(null);

  // 알려진 CORS 미지원 도메인(c.incru.it, incruit.com)은 브라우저의 crossOrigin 시도로
  // "No 'Access-Control-Allow-Origin'" 경고 로그가 찍히는 것을 피하기 위해 바로 proxy로.
  if (/^https?:\/\/(?:[^/]*\.)?(?:incru\.it|incruit\.com)\//.test(src)) {
    return _withTimeout(fetchImageViaProxy(src), 8000);
  }

  // blob: URL (clipboard paste 등 로컬 blob) → canvas로 dataURL 변환
  if (src.startsWith('blob:')) {
    return _withTimeout(new Promise((resolve) => {
      const tempImg = new Image();
      tempImg.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = tempImg.naturalWidth;
          c.height = tempImg.naturalHeight;
          c.getContext('2d').drawImage(tempImg, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch { resolve(null); }
      };
      tempImg.onerror = () => resolve(null);
      tempImg.src = src; // blob은 same-origin이라 CORS 불필요
    }), 5000);
  }

  return _withTimeout(new Promise((resolve) => {
    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = tempImg.naturalWidth;
        c.height = tempImg.naturalHeight;
        c.getContext('2d').drawImage(tempImg, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch {
        // canvas tainted (CORS 미지원) → 프록시로 폴백 (내부에도 8s 타임아웃 있음)
        resolve(fetchImageViaProxy(src));
      }
    };
    // crossOrigin 요청 실패 → 프록시로 폴백
    tempImg.onerror = () => resolve(fetchImageViaProxy(src));
    // 캐시버스터: CORS 없이 캐시된 이미지를 새 CORS 요청으로 강제 로드
    const sep = src.includes('?') ? '&' : '?';
    tempImg.src = src + sep + '_cb=' + Date.now();
  }), 10000);
}

// 외부(cross-origin) 스타일시트를 proxy로 fetch → <style>로 추가 (link은 그대로 유지).
// dom-to-image가 cssRules 읽기 실패하는 CORS-restricted CDN CSS를 same-origin 사본으로 제공.
// 원 link는 disable 하지 않음 — 라이브 렌더는 그대로, dom-to-image만 추가 읽기 가능.
async function inlineExternalStylesheets() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"][href]'));
  const snapshots = [];
  const currentOrigin = window.location.origin;
  await Promise.all(links.map(async (link) => {
    const href = link.href;
    if (!href) return;
    let isCross = true;
    try { isCross = new URL(href).origin !== currentOrigin; } catch { return; }
    if (!isCross) return;
    try {
      const resp = await fetch('/proxy/?url=' + encodeURIComponent(href), { signal: AbortSignal.timeout(6000) });
      if (!resp.ok) return;
      const css = await resp.text();
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-inlined-from', href);
      styleEl.textContent = css;
      // link 바로 뒤에 삽입 — 원 link의 cascade 순서 존중, dom-to-image는 same-origin 사본을 읽음
      link.parentNode.insertBefore(styleEl, link.nextSibling);
      snapshots.push({ styleEl });
    } catch (_) { /* proxy 실패는 무시 — 해당 CSS 없이 렌더됨 */ }
  }));
  return () => {
    snapshots.forEach(s => s.styleEl.remove());
  };
}

// 외부 URL 이미지만 DataURL로 교체 — gradient/html2canvas workaround는 적용하지 않음.
// dom-to-image는 브라우저 네이티브 렌더라 gradient를 직접 처리 가능하므로 원본 style 유지.
async function prepareImagesForCapture(card) {
  const bgItems = [];
  [card, ...card.querySelectorAll('*')].forEach(el => {
    const inlineBg = el.style.backgroundImage || '';
    const computedBg = window.getComputedStyle(el).backgroundImage || '';
    const bg = inlineBg || computedBg;
    if (!bg || bg === 'none') return;
    const m = bg.match(/url\(['"]?(.+?)['"]?\)/);
    const url = m?.[1];
    if (url && !url.startsWith('data:')) {
      bgItems.push({ el, inlineOriginal: inlineBg, url });
    }
  });
  const imgEls = Array.from(card.querySelectorAll('img[src]:not([src^="data:"])'));
  const origSrcs = imgEls.map(img => img.src);
  await Promise.all([
    ...bgItems.map(async item => {
      const dataUrl = await reloadImageWithCors(item.url);
      if (dataUrl) {
        item.el.style.backgroundImage = `url('${dataUrl}')`;
        item._applied = true;
      }
    }),
    ...imgEls.map(async img => {
      const dataUrl = await reloadImageWithCors(img);
      if (dataUrl) img.src = dataUrl;
    }),
  ]);
  return () => {
    bgItems.forEach(it => {
      if (!it._applied) return;
      if (it.inlineOriginal) it.el.style.backgroundImage = it.inlineOriginal;
      else it.el.style.removeProperty('background-image');
    });
    imgEls.forEach((img, i) => { img.src = origSrcs[i]; });
  };
}

// html2canvas 전용 workaround — dom-to-image 폴백 시에만 적용.
// photoTop2 gradient solid 교체, gradient span 제거(부모 color 상속), pseudo 배경 오버라이드.
async function applyHtml2canvasWorkarounds(card) {
  // photoTop2 카드의 transparent→solid 하드스텝 gradient는 html2canvas에서 transparent
  // 영역이 canvas 바탕(흰색)으로 렌더되어 공고제목 위로 흰 배경이 올라오는 버그가 있음.
  // 캡처 동안 solid 배경색으로 임시 교체. bg 색은 `.kv-photo-top2-content`의 inline
  // backgroundColor에서 직접 읽어 신뢰성 확보.
  const top2Cards = Array.from(card.querySelectorAll('.kv-card.kv-photo-top2'));
  const top2Items = top2Cards.map(el => {
    const contentDiv = el.querySelector('.kv-photo-top2-content');
    const solid = (contentDiv && contentDiv.style.backgroundColor)
      || window.getComputedStyle(contentDiv || el).backgroundColor
      || '#111111';
    return {
      el,
      originalCssText: el.style.cssText,
      solid,
    };
  });
  top2Items.forEach(it => {
    // cssText 통째로 교체: 기존 gradient 이하 관련 속성을 모두 클리어하고 solid로.
    it.el.style.cssText = `background-color: ${it.solid};`;
  });

  // Gradient text span: html2canvas가 background-clip:text를 제대로 렌더하지 못해
  // gradient가 블록 배경으로 나오는 버그. 캡처 동안 solid 색(첫 stop)으로 대체하여
  // 최소 텍스트 가시성 확보. 원복 시 cssText 통째 복원.
  // 신 shorthand `background: ... text`도 인식 (Chrome이 backgroundClip에 값을 안 담는 경우 포함).
  const gradSpans = Array.from(card.querySelectorAll('span'))
    .filter(s => {
      if (!s.style) return false;
      const bg = s.style.background || '';
      if (!/(?:linear|radial)-gradient/i.test(bg)) return false;
      return (
        /text/i.test(s.style.backgroundClip || '') ||
        /text/i.test(s.style.webkitBackgroundClip || '') ||
        /\btext\s*;?\s*$/i.test(bg) ||
        s.style.webkitTextFillColor === 'transparent' ||
        /transparent/i.test(s.style.color || '')
      );
    });
  const gradSpanSnapshots = gradSpans.map(s => ({
    el: s,
    originalCssText: s.style.cssText,
  }));
  // gradient를 SVG 이미지로 렌더해서 <img>로 대체 — gradient 효과 PNG에 보존.
  // 실패 시 gradient 속성만 제거해 부모 color 상속 방식으로 폴백.
  gradSpans.forEach(s => {
    const rect = s.getBoundingClientRect();
    const text = s.textContent || '';
    const bg = s.style.background || '';
    const gradMatch = bg.match(/linear-gradient\(([^)]+?)\)/);
    if (!rect.width || !rect.height || !text || !gradMatch) {
      // fallback: gradient 속성만 제거 (solid 색 강제 X → 부모 color 상속)
      ['background', 'background-image', 'background-clip', '-webkit-background-clip',
       'background-color', '-webkit-text-fill-color', 'display',
       'box-decoration-break', '-webkit-box-decoration-break'].forEach(p => s.style.removeProperty(p));
      if (/transparent/i.test(s.style.color || '')) s.style.removeProperty('color');
      return;
    }
    // CSS angle → SVG x1/y1/x2/y2 (objectBoundingBox 0~1)
    const parts = gradMatch[1].split(',').map(v => v.trim());
    let angle = 180; // 기본: to bottom
    let stopsStart = 0;
    const first = parts[0];
    if (/deg\s*$/.test(first)) { angle = parseFloat(first); stopsStart = 1; }
    else if (/^to\s/i.test(first)) {
      if (/right/i.test(first)) angle = 90;
      else if (/left/i.test(first)) angle = 270;
      else if (/top/i.test(first)) angle = 0;
      else if (/bottom/i.test(first)) angle = 180;
      stopsStart = 1;
    }
    const stops = parts.slice(stopsStart);
    if (stops.length < 2) {
      // stop이 2개 미만이면 gradient로 렌더 불가 → fallback
      ['background', 'background-image', 'background-clip', '-webkit-background-clip',
       'background-color', '-webkit-text-fill-color', 'display',
       'box-decoration-break', '-webkit-box-decoration-break'].forEach(p => s.style.removeProperty(p));
      return;
    }
    const ar = angle * Math.PI / 180;
    const x1 = (0.5 - 0.5 * Math.sin(ar)).toFixed(3);
    const y1 = (0.5 + 0.5 * Math.cos(ar)).toFixed(3);
    const x2 = (0.5 + 0.5 * Math.sin(ar)).toFixed(3);
    const y2 = (0.5 - 0.5 * Math.cos(ar)).toFixed(3);
    const stopsSvg = stops.map((c, i) => {
      const pct = stops.length === 1 ? '0' : (i / (stops.length - 1) * 100).toFixed(2);
      // color에 offset이 포함된 경우 (예: "rgb(0,0,0) 50%") — 분리
      const cm = c.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)(\s+.+)?$/i);
      const color = cm ? cm[1] : c;
      return `<stop offset="${pct}%" stop-color="${color}"/>`;
    }).join('');
    const cs = window.getComputedStyle(s);
    const fontSize = parseFloat(cs.fontSize) || 16;
    const fontFamily = (cs.fontFamily || 'sans-serif').replace(/"/g, "'");
    const fontWeight = cs.fontWeight || 'normal';
    const w = Math.ceil(rect.width);
    const h = Math.ceil(rect.height);
    const gid = 'g-' + Math.random().toString(36).slice(2, 8);
    const escText = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsSvg}</linearGradient></defs><text x="0" y="${(fontSize * 0.82).toFixed(2)}" font-family="${fontFamily}" font-weight="${fontWeight}" font-size="${fontSize}" fill="url(#${gid})">${escText}</text></svg>`;
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    // span의 원래 innerHTML을 스냅샷에 기록 (복원용)
    const snap = gradSpanSnapshots.find(x => x.el === s);
    if (snap) snap.originalInnerHTML = s.innerHTML;
    s.innerHTML = `<img src="${dataUrl}" style="display:block;width:${w}px;height:${h}px;" alt="">`;
    s.style.cssText = `display:inline-block;vertical-align:middle;`;
  });

  // Pseudo-element(::before/::after) 배경 이미지: html2canvas가 CDN 이미지를
  // CORS로 못 가져와 블릿/번호 아이콘 배경이 누락됨. 사전에 dataURL로 변환 후 <style>로 주입.
  // 모든 하위 요소를 대상으로 ::before/::after 배경을 검사 (기존 특정 클래스 셀렉터는 누락 케이스 발생).
  const pseudoTargets = Array.from(card.querySelectorAll('*'));
  const pseudoStyleRules = [];
  let _pseudoIdCounter = 0;
  const pseudoTagged = [];
  await Promise.all(pseudoTargets.flatMap(el => ['before', 'after'].map(async which => {
    try {
      const bg = window.getComputedStyle(el, `::${which}`).backgroundImage;
      if (!bg || bg === 'none') return;
      const m = bg.match(/url\(['"]?(.+?)['"]?\)/);
      const url = m?.[1];
      if (!url || url.startsWith('data:')) return;
      const dataUrl = await reloadImageWithCors(url);
      if (!dataUrl) return;
      const id = `pcap-${++_pseudoIdCounter}`;
      if (!el.hasAttribute('data-capture-pseudo-id')) {
        el.setAttribute('data-capture-pseudo-id', id);
        pseudoTagged.push(el);
      }
      // 기존 배경 속성(position/size/repeat 등)을 computed에서 가져와 유지
      const cs = window.getComputedStyle(el, `::${which}`);
      const bgPos = cs.backgroundPosition || '0 0';
      const bgRepeat = cs.backgroundRepeat || 'no-repeat';
      const bgSize = cs.backgroundSize || 'auto';
      pseudoStyleRules.push(
        `[data-capture-pseudo-id="${el.getAttribute('data-capture-pseudo-id')}"]::${which}{` +
        `background-image:url('${dataUrl}') !important;` +
        `background-position:${bgPos} !important;` +
        `background-repeat:${bgRepeat} !important;` +
        `background-size:${bgSize} !important;}`
      );
    } catch (_) {}
  })));
  let pseudoStyleEl = null;
  if (pseudoStyleRules.length > 0) {
    pseudoStyleEl = document.createElement('style');
    pseudoStyleEl.id = 'html2canvas-pseudo-fixup';
    pseudoStyleEl.textContent = pseudoStyleRules.join('\n');
    document.head.appendChild(pseudoStyleEl);
  }

  // html2canvas workaround 캡처 후 원복
  return () => {
    top2Items.forEach(it => {
      it.el.style.cssText = it.originalCssText || '';
    });
    gradSpanSnapshots.forEach(s => {
      s.el.style.cssText = s.originalCssText || '';
      if (s.originalInnerHTML != null) s.el.innerHTML = s.originalInnerHTML;
    });
    if (pseudoStyleEl) pseudoStyleEl.remove();
    pseudoTagged.forEach(el => el.removeAttribute('data-capture-pseudo-id'));
  };
}

async function handleDownloadPng() {
  if (!await checkVerifyGate('다운로드')) return;
  const preview = document.getElementById('template-preview');
  if (!preview) return;

  // build 418: 이미지 저장 포맷 선택 (png/jpg/pdf)
  const fmt = (state.imageSaveFormat || localStorage.getItem('image_save_format') || 'png').toLowerCase();
  const serverFmt = fmt === 'jpg' ? 'jpeg' : fmt;
  const ext = fmt === 'jpeg' ? 'jpg' : fmt;

  const btn = document.getElementById('btn-download-png');
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="loading"></span> ${fmt.toUpperCase()} 생성 중...`; }

  const origStyle = preview.style.cssText;
  const toolbar = document.getElementById('floating-toolbar');
  if (toolbar) toolbar.style.display = 'none';
  const tblToolbar = document.getElementById('table-toolbar');
  if (tblToolbar) tblToolbar.style.display = 'none';

  // preview-content의 padding 24px 임시 제거 (여백 없이 900px 꽉차게)
  const previewContent = document.getElementById('preview-content');
  const origContentPadding = previewContent?.style.padding ?? '';
  if (previewContent) previewContent.style.padding = '0';

  // 외부 채용공고 체크 시 copyright 이미지를 캡처 대상에 임시 삽입.
  // prepareCardForCapture보다 먼저 추가해야 이미지도 CORS 우회 변환 대상에 포함됨.
  let tempCopyrightEl = null;
  let tempCopyrightRestoreDisplay = null;
  if (state.isExternalPost) {
    const existing = (previewContent || preview).querySelector('img[src*="copyright.png"]');
    if (!existing) {
      tempCopyrightEl = document.createElement('div');
      tempCopyrightEl.setAttribute('data-temp-copyright', '1');
      tempCopyrightEl.style.cssText = 'display:block; width:900px; margin:0 auto;';
      tempCopyrightEl.innerHTML = '<img src="https://c.incru.it/newjobpost/2026/common/copyright.png" style="display:block; max-width:100%;">';
      (previewContent || preview).appendChild(tempCopyrightEl);
    } else {
      const wrap = existing.closest('div');
      if (wrap && (wrap.style.display === 'none' || getComputedStyle(wrap).display === 'none')) {
        tempCopyrightRestoreDisplay = wrap.style.display;
        wrap.style.display = 'block';
        tempCopyrightEl = wrap;
      }
    }
  }

  // 외부 URL 이미지(img 태그 + CSS background-image) → DataURL 변환 (CORS 우회)
  // ※ 위의 임시 copyright img도 여기 변환 대상에 포함되어야 하므로 이 호출이 copyright 추가 *뒤*에 있어야 함
  const restoreImages = await prepareImagesForCapture(preview);

  try {
    preview.style.width = '900px';
    preview.style.minWidth = '900px';
    preview.style.maxWidth = '900px';
    preview.style.overflow = 'visible';
    preview.style.flex = 'none';
    preview.style.margin = '0';
    preview.style.padding = '0';

    // 1차 시도: 서버사이드 Playwright (완전 픽셀 복제) — /api/render-full POST
    let pngDataUrl = null;
    try {
      // 붙여넣은 원본 HTML에 templwrap_v3가 있으면 raw 그대로 사용 (KV 구조가 .templ_header가
      // 아닌 .position:relative div로 들어간 케이스 등 generateFullHtml 재구성 실패 방지).
      // 그 외에는 generateFullHtml로 state 기반 재구성.
      const srcRaw = state.originalSource?.raw || '';
      const useSrcRaw = srcRaw && /id=["']?templwrap_v3/i.test(srcRaw);
      let fullHtmlForCapture = useSrcRaw
        ? srcRaw
        : ((typeof generateFullHtml === 'function') ? generateFullHtml() : preview.outerHTML);
      // raw 경로는 applyPostTypeProcessing(외부 채용공고 copyright 변환/주입, 웍스 CSS 제거 등)을
      // 거치지 않으므로 여기서 수동 적용.
      if (useSrcRaw && typeof applyPostTypeProcessing === 'function') {
        try { fullHtmlForCapture = applyPostTypeProcessing(fullHtmlForCapture); } catch (_) {}
      }
      const resp = await fetch('/api/render-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: fullHtmlForCapture,
          width: 900,
          scale: 1,
          format: serverFmt,  // 'png' | 'jpeg' | 'pdf'
        }),
        signal: AbortSignal.timeout(120000),
      });
      const contentType = resp.headers.get('Content-Type') || '';
      // png/jpeg는 image/*, pdf는 application/pdf
      const isValidContent = (contentType.startsWith('image/') || contentType === 'application/pdf');
      if (resp.ok && isValidContent) {
        const blob = await resp.blob();
        if (blob.size > 100) {
          pngDataUrl = URL.createObjectURL(blob);
        } else {
          console.warn('[' + fmt + '] 서버 응답 크기 이상:', blob.size);
        }
      } else if (resp.ok) {
        const text = await resp.text();
        console.warn('[' + fmt + '] 서버 응답 타입 이상:', contentType, text.slice(0, 300));
      } else {
        const text = await resp.text().catch(() => '');
        console.warn('[' + fmt + '] 서버 실패 status:', resp.status, text.slice(0, 300));
      }
    } catch (e) {
      console.warn('[' + fmt + '] 서버 요청 실패:', e.message);
    }

    // PDF는 서버 전용 — 실패 시 에러
    if (fmt === 'pdf' && !pngDataUrl) {
      throw new Error('PDF 생성은 서버(Playwright)만 지원합니다. 서버 응답을 확인하세요.');
    }

    // Playwright 성공하면 스킵. 아니면 html2canvas 클라이언트 폴백 (PNG/JPG만).
    if (!pngDataUrl) {

    // Gradient 텍스트 span 사전 측정 — 복제본에서 inline SVG로 교체하기 위한 메타 수집.
    // SVG <text fill="url(#grad)">는 html2canvas가 표준 벡터로 정상 렌더.
    const gradSpanMeta = [];
    preview.querySelectorAll('span').forEach(span => {
      const style = span.getAttribute('style') || '';
      const hasGradClip = /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text|linear-gradient[^;]*\btext\b/i.test(style);
      const hasTransparentFill = /webkit-text-fill-color\s*:\s*transparent/i.test(style);
      if (!hasGradClip && !hasTransparentFill) return;
      const rect = span.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const bgRaw = span.style.background || span.style.backgroundImage || window.getComputedStyle(span).backgroundImage || '';
      const m = bgRaw.match(/linear-gradient\(([^)]+?)\)/);
      if (!m) return;
      const parts = m[1].split(',').map(s => s.trim());
      let angle = 180, stopsStart = 0;
      if (/deg\s*$/.test(parts[0])) { angle = parseFloat(parts[0]); stopsStart = 1; }
      else if (/^to\s/i.test(parts[0])) {
        if (/right/i.test(parts[0])) angle = 90;
        else if (/left/i.test(parts[0])) angle = 270;
        else if (/top/i.test(parts[0])) angle = 0;
        else angle = 180;
        stopsStart = 1;
      }
      const colors = parts.slice(stopsStart).map(c => {
        const cm = c.match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)(\s+.+)?$/i);
        return cm ? cm[1] : c;
      }).filter(Boolean);
      if (colors.length < 2) return;
      const cs = window.getComputedStyle(span);
      // 부모의 실제 color를 측정 — 캡처 시 solid 텍스트로 쓸 색상
      // (가장 가까운 명시 color ancestor 찾기)
      let parentColor = '';
      let p = span.parentElement;
      while (p) {
        const pc = window.getComputedStyle(p).color;
        if (pc && pc !== 'rgba(0, 0, 0, 0)' && pc !== 'transparent') { parentColor = pc; break; }
        p = p.parentElement;
      }
      if (!parentColor) parentColor = '#121212'; // 안전 기본값

      const id = `gs-${gradSpanMeta.length}`;
      span.setAttribute('data-grad-capture-id', id);
      gradSpanMeta.push({
        id,
        text: span.textContent || '',
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        fontSize: parseFloat(cs.fontSize) || 16,
        fontFamily: (cs.fontFamily || 'sans-serif').replace(/"/g, "'"),
        fontWeight: cs.fontWeight || 'normal',
        angle, colors, parentColor,
      });
    });

    // Pseudo-element(::before/::after) 배경 이미지 URL → dataURL 미리 해결
    // (onclone은 동기라 async fetch 불가 → 사전 수집)
    const pseudoStyleRules = [];
    let _pcid = 0;
    const pseudoTaggedLive = [];
    const pseudoAllEls = Array.from(preview.querySelectorAll('*'));
    await Promise.all(pseudoAllEls.flatMap(el => ['before', 'after'].map(async which => {
      try {
        const bg = window.getComputedStyle(el, `::${which}`).backgroundImage;
        if (!bg || bg === 'none') return;
        const m = bg.match(/url\(['"]?(.+?)['"]?\)/);
        const url = m?.[1];
        if (!url || url.startsWith('data:')) return;
        const dataUrl = await reloadImageWithCors(url);
        if (!dataUrl) return;
        const id = `pcap-${++_pcid}`;
        if (!el.hasAttribute('data-capture-pseudo-id')) {
          el.setAttribute('data-capture-pseudo-id', id);
          pseudoTaggedLive.push(el);
        }
        const cs = window.getComputedStyle(el, `::${which}`);
        pseudoStyleRules.push(
          `[data-capture-pseudo-id="${el.getAttribute('data-capture-pseudo-id')}"]::${which}{` +
          `background-image:url('${dataUrl}') !important;` +
          `background-position:${cs.backgroundPosition || '0 0'} !important;` +
          `background-repeat:${cs.backgroundRepeat || 'no-repeat'} !important;` +
          `background-size:${cs.backgroundSize || 'auto'} !important;}`
        );
      } catch (_) {}
    })));

    // html2canvas + onclone — 복제본에서만 gradient/pseudo/photoTop2 수정 (live DOM 무손상)
    let pngDataUrl = null;
    try {
      const canvas = await html2canvas(preview, {
        scale: 2,
        width: 900,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        x: 0,
        y: 0,
        onclone: (clonedDoc) => {
          // (1) Gradient 텍스트 span: html2canvas가 background-clip:text 미지원 + SVG 교체도
          //     폰트 메트릭 차이로 텍스트 잘림 문제 → gradient 포기하고 부모 color 상속하는
          //     solid 텍스트로 렌더. 레이아웃/가독성은 완벽 보존 (gradient 효과만 단색화).
          //     라이브 프리뷰는 onclone이 복제본만 수정하므로 그대로 gradient 표시.
          // 사전 수집된 gradient span들 처리
          const applyStripGradient = (el, parentColor) => {
            ['background', 'background-image', 'background-clip', '-webkit-background-clip',
             'background-color', '-webkit-text-fill-color', 'display',
             'box-decoration-break', '-webkit-box-decoration-break'].forEach(p => el.style.removeProperty(p));
            if (/transparent/i.test(el.style.color || '')) el.style.removeProperty('color');
            el.style.color = parentColor;
            el.style.webkitTextFillColor = parentColor;  // 강제로 solid
            el.style.position = 'relative';
            el.style.zIndex = '1';
          };
          gradSpanMeta.forEach(meta => {
            const el = clonedDoc.querySelector(`[data-grad-capture-id="${meta.id}"]`);
            if (el) applyStripGradient(el, meta.parentColor);
          });
          // 안전망: 사전 감지를 놓친 transparent fill / gradient span을 복제본에서 직접 찾아 동일 처리
          clonedDoc.querySelectorAll('span').forEach(el => {
            const s = el.getAttribute('style') || '';
            const hasGradOrTransparent = /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text|linear-gradient[^;]*\btext\b|-webkit-text-fill-color\s*:\s*transparent/i.test(s);
            if (!hasGradOrTransparent) return;
            // 이미 처리된 노드 스킵
            if (el.style.webkitTextFillColor && el.style.webkitTextFillColor !== 'transparent') return;
            // 부모 color 찾기
            let pc = '';
            let p = el.parentElement;
            while (p) {
              const pcv = window.getComputedStyle(p).color;
              if (pcv && pcv !== 'rgba(0, 0, 0, 0)' && pcv !== 'transparent') { pc = pcv; break; }
              p = p.parentElement;
            }
            applyStripGradient(el, pc || '#121212');
          });
          // (2) kv-title-text line-height 보정
          clonedDoc.querySelectorAll('.kv-title-text').forEach(el => {
            if (!el.style.lineHeight) el.style.lineHeight = '1.4';
          });
          // (3) photoTop2 카드 transparent→solid gradient를 solid로 (복제본만)
          clonedDoc.querySelectorAll('.kv-card.kv-photo-top2').forEach(el => {
            const content = el.querySelector('.kv-photo-top2-content');
            const solid = (content && content.style.backgroundColor) || '#111111';
            el.style.cssText = `background-color:${solid};`;
          });
          // (4) pseudo-element 배경을 proxy로 받은 dataURL로 오버라이드 (복제본만)
          if (pseudoStyleRules.length > 0) {
            const styleEl = clonedDoc.createElement('style');
            styleEl.textContent = pseudoStyleRules.join('\n');
            clonedDoc.head.appendChild(styleEl);
          }
        },
      });
      pngDataUrl = canvas.toDataURL('image/' + (serverFmt === 'jpeg' ? 'jpeg' : 'png'));
    } finally {
      // 라이브 DOM에 남은 임시 속성 정리
      pseudoTaggedLive.forEach(el => el.removeAttribute('data-capture-pseudo-id'));
      preview.querySelectorAll('[data-grad-capture-id]').forEach(el => el.removeAttribute('data-grad-capture-id'));
    }

    } // end of !pngDataUrl (client 폴백 블록)

    const link = document.createElement('a');
    link.download = `jobpost-${state.jobNumber || 'preview'}.${ext}`;
    link.href = pngDataUrl;
    link.click();
    // Blob URL(`blob:...`) 사용 시 1초 뒤 revoke
    if (typeof pngDataUrl === 'string' && pngDataUrl.startsWith('blob:')) {
      setTimeout(() => { try { URL.revokeObjectURL(pngDataUrl); } catch (_) {} }, 1000);
    }
  } catch (err) {
    console.error('이미지 저장 실패:', err);
    showToast(fmt.toUpperCase() + ' 저장에 실패했습니다: ' + err.message);
  } finally {
    restoreImages();
    if (previewContent) previewContent.style.padding = origContentPadding;
    preview.style.cssText = origStyle;
    // copyright 임시 삽입 원복
    if (tempCopyrightEl) {
      if (tempCopyrightEl.getAttribute('data-temp-copyright') === '1') {
        tempCopyrightEl.remove();
      } else if (tempCopyrightRestoreDisplay !== null) {
        tempCopyrightEl.style.display = tempCopyrightRestoreDisplay || '';
      }
    }
    if (toolbar) toolbar.style.display = '';
    if (tblToolbar) tblToolbar.style.display = '';
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> <span>이미지 저장</span> <span id="image-save-format-label" class="opacity-70 text-xs">(${fmt.toUpperCase()})</span>`;
    }
  }
}

function setupResizeHandles() {
  const handles = document.querySelectorAll('.resize-handle');

  handles.forEach(handle => {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      handle.classList.add('active');

      const targetId = handle.dataset.resize;
      const target = document.getElementById(targetId);
      startWidth = target.offsetWidth;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (!isResizing) return;

      const targetId = handle.dataset.resize;
      const diff = e.clientX - startX;

      if (targetId === 'settings-panel') {
        const newWidth = Math.max(200, Math.min(400, startWidth - diff));
        document.documentElement.style.setProperty('--panel-settings', newWidth + 'px');
      } else if (targetId === 'chat-panel') {
        const newWidth = Math.max(250, Math.min(450, startWidth - diff));
        document.documentElement.style.setProperty('--panel-chat', newWidth + 'px');
      }
    }

    function onMouseUp() {
      isResizing = false;
      handle.classList.remove('active');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  });
}

// ============================================
// Key Visual Generator
// ============================================
function setupKeyVisual() {
  // Settings tab switching
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabId = tab.dataset.settingsTab;
      state.activeSettingsTab = tabId;

      document.getElementById('tab-jobpost').classList.toggle('hidden', tabId !== 'jobpost');
      document.getElementById('tab-keyvisual').classList.toggle('hidden', tabId !== 'keyvisual');

      // KV 탭 진입 시 자동 채우기 + 렌더링
      if (tabId === 'keyvisual') {
        const badge = tab.querySelector('.kv-ready-badge');
        if (badge) badge.remove();
        tryAutoFillKvFromSource();
        renderKvPreview();
      }

      // 미리보기는 항상 통합 뷰 유지 — 더 이상 preview 토글하지 않음
    });
  });

  // ---- KV 토글 스위치 ----
  const kvToggle = document.getElementById('kv-toggle');
  if (kvToggle) {
    kvToggle.addEventListener('change', () => {
      state.kvEnabled = kvToggle.checked;
      syncKvVisibility();
      syncNonKvFieldsVisibility();
      refreshJobNumberInPreview(); // KV ON 시 DOM에서 비KV 텍스트 요소 즉시 제거
      // HTML 코드 뷰도 업데이트
      if (state.activeView === 'code') {
        updateHtmlCode();
      }
    });
  }

  // ---- 공고 타입 체크박스 ----
  document.getElementById('chk-works-post')?.addEventListener('change', (e) => {
    state.isWorksPost = e.target.checked;
    updateHtmlCode();
  });
  document.getElementById('chk-rasp')?.addEventListener('change', (e) => {
    state.isRasp = e.target.checked;
    updateHtmlCode();
  });
  document.getElementById('chk-external-post')?.addEventListener('change', (e) => {
    state.isExternalPost = e.target.checked;
    updateHtmlCode();
  });

  // ---- 편집 모드 토글 ----
  const editModeToggle = document.getElementById('edit-mode-toggle');
  if (editModeToggle) {
    editModeToggle.addEventListener('change', () => {
      state.editMode = editModeToggle.checked;
      toggleEditMode(state.editMode);
    });
  }

  // ---- Field Settings Toggle (설정 ▼/▲) ----
  document.querySelectorAll('.kv-field-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.kvField;
      const panel = document.getElementById(`kv-settings-${field}`);
      if (!panel) return;
      const isHidden = panel.classList.toggle('hidden');
      btn.textContent = isHidden ? '설정 ▼' : '설정 ▲';
    });
  });

  // ---- Field Style Controls (slider, color, bold) ----
  // Range ↔ Number 양방향 동기화
  document.querySelectorAll('.kv-field-settings .kv-slider').forEach(slider => {
    slider.addEventListener('input', () => {
      const { field, prop } = slider.dataset;
      const numberInput = slider.parentElement.querySelector('.kv-value-input');
      if (numberInput) numberInput.value = slider.value;
      state.kv.fieldStyles[field][prop] = Number(slider.value);
      renderKvPreview();
    });
  });

  document.querySelectorAll('.kv-field-settings .kv-value-input').forEach(numInput => {
    numInput.addEventListener('input', () => {
      const { field, prop } = numInput.dataset;
      const slider = numInput.parentElement.querySelector('.kv-slider');
      if (slider) slider.value = numInput.value;
      state.kv.fieldStyles[field][prop] = Number(numInput.value);
      renderKvPreview();
    });
  });

  // Color ↔ Hex 양방향 동기화
  document.querySelectorAll('.kv-field-settings input[type="color"]').forEach(picker => {
    picker.addEventListener('input', () => {
      const { field, prop } = picker.dataset;
      const hexInput = picker.parentElement.querySelector('.kv-hex-input');
      if (hexInput) hexInput.value = picker.value.toUpperCase();
      state.kv.fieldStyles[field][prop] = picker.value.toUpperCase();
      renderKvPreview();
    });
  });

  document.querySelectorAll('.kv-field-settings .kv-hex-input').forEach(hexInput => {
    hexInput.addEventListener('input', () => {
      const { field, prop } = hexInput.dataset;
      const v = hexInput.value;
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        const picker = hexInput.parentElement.querySelector('input[type="color"]');
        if (picker) picker.value = v;
        state.kv.fieldStyles[field][prop] = v.toUpperCase();
        renderKvPreview();
      }
    });
  });

  // Font family select
  document.querySelectorAll('.kv-field-settings .kv-font-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const { field } = sel.dataset;
      if (!state.kv.fieldStyles[field]) return;
      state.kv.fieldStyles[field].fontFamily = sel.value;
      renderKvPreview();
    });
  });

  // Bold checkbox → fontWeight 연동 (400 ↔ 700)
  document.querySelectorAll('.kv-field-settings input[type="checkbox"][data-prop="bold"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const { field } = cb.dataset;
      if (!state.kv.fieldStyles[field]) return;
      state.kv.fieldStyles[field].bold = cb.checked;
      state.kv.fieldStyles[field].fontWeight = cb.checked ? 700 : 400;
      const weightSel = document.querySelector(`.kv-weight-select[data-field="${field}"]`);
      if (weightSel) weightSel.value = state.kv.fieldStyles[field].fontWeight;
      renderKvPreview();
    });
  });

  // Font weight select
  document.querySelectorAll('.kv-field-settings .kv-weight-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const { field } = sel.dataset;
      if (!state.kv.fieldStyles[field]) return;
      const w = Number(sel.value);
      state.kv.fieldStyles[field].fontWeight = w;
      state.kv.fieldStyles[field].bold = w >= 700;
      const boldCb = document.querySelector(`.kv-field-settings input[data-field="${field}"][data-prop="bold"]`);
      if (boldCb) boldCb.checked = w >= 700;
      renderKvPreview();
    });
  });

  // KV 필드별 정렬 버튼
  document.querySelectorAll('.kv-field-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const { field, align } = btn.dataset;
      if (!state.kv.fieldStyles[field]) return;
      state.kv.fieldStyles[field].align = align;
      document.querySelectorAll(`.kv-field-align-btn[data-field="${field}"]`).forEach(b => b.classList.toggle('active', b.dataset.align === align));
      renderKvPreview();
    });
  });

  // ---- Text Position Controls ----
  // Show/hide position section based on height mode (global function)
  updatePositionSectionVisibility();

  // Position accordion toggles
  document.querySelectorAll('.kv-pos-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.posField;
      const body = document.querySelector(`[data-pos-body="${field}"]`);
      if (body) {
        body.classList.toggle('hidden');
        btn.classList.toggle('open');
      }
    });
  });

  // Position sliders
  document.querySelectorAll('[data-pos]').forEach(el => {
    if (el.tagName === 'INPUT') {
      el.addEventListener('input', () => {
        const { pos: field, axis } = el.dataset;
        const isSlider = el.type === 'range';
        const sibling = el.parentElement.querySelector(isSlider ? '.kv-value-input' : '.kv-slider');
        if (sibling) sibling.value = el.value;
        state.kv.textPosition[field][axis] = Number(el.value);
        renderKvPreview();
      });
    }
  });

  // Text inputs - debounced preview update
  const kvTextInputs = ['kv-job-code', 'kv-org-name', 'kv-title', 'kv-description', 'kv-description2', 'kv-date-company'];
  kvTextInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        syncKvState();
        debounceKvPreview();
      });
    }
  });

  // Template type buttons
  document.querySelectorAll('[data-kv-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-kv-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kv.templateType = btn.dataset.kvType;
      const splitGroup = document.getElementById('kv-split-layout-group');
      if (splitGroup) splitGroup.style.display = btn.dataset.kvType === 'split' ? '' : 'none';
      renderKvPreview();
    });
  });

  // Split layout buttons (텍스트 배치)
  document.querySelectorAll('[data-kv-split-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-kv-split-layout]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kv.splitLayout = btn.dataset.kvSplitLayout;
      renderKvPreview();
    });
  });

  // Text align buttons
  document.querySelectorAll('[data-kv-align]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-kv-align]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kv.textAlign = btn.dataset.kvAlign;
      renderKvPreview();
    });
  });

  // Effect buttons
  document.querySelectorAll('[data-kv-effect]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-kv-effect]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kv.effect = btn.dataset.kvEffect;
      renderKvPreview();
    });
  });

  // Text shadow buttons
  document.querySelectorAll('[data-kv-shadow]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-kv-shadow]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kv.textShadow = btn.dataset.kvShadow;
      renderKvPreview();
    });
  });

  // Height mode buttons
  document.querySelectorAll('[data-kv-height]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-kv-height]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.kv.heightMode = btn.dataset.kvHeight;
      updatePositionSectionVisibility();
      renderKvPreview();
    });
  });

  // Color inputs
  const kvBgColor = document.getElementById('kv-bg-color');
  const kvBgColorText = document.getElementById('kv-bg-color-text');
  const kvBrandColor = document.getElementById('kv-brand-color');
  const kvBrandColorText = document.getElementById('kv-brand-color-text');

  kvBgColor.addEventListener('input', (e) => {
    kvBgColorText.value = e.target.value;
    state.kv.bgColor = e.target.value;
    renderKvPreview();
  });
  kvBgColorText.addEventListener('input', (e) => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      kvBgColor.value = v;
      state.kv.bgColor = v;
      renderKvPreview();
    }
  });
  kvBrandColor.addEventListener('input', (e) => {
    kvBrandColorText.value = e.target.value;
    state.kv.brandColor = e.target.value;
    renderKvPreview();
  });
  kvBrandColorText.addEventListener('input', (e) => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      kvBrandColor.value = v;
      state.kv.brandColor = v;
      renderKvPreview();
    }
  });

  // 실사공고 배경색 (photoTop 전용)
  const kvPhotoBg = document.getElementById('kv-photo-content-bg');
  const kvPhotoBgText = document.getElementById('kv-photo-content-bg-text');
  kvPhotoBg?.addEventListener('input', (e) => {
    kvPhotoBgText.value = e.target.value;
    state.kv.photoContentBg = e.target.value;
    renderKvPreview();
  });
  kvPhotoBgText?.addEventListener('input', (e) => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      kvPhotoBg.value = v;
      state.kv.photoContentBg = v;
      renderKvPreview();
    }
  });

  // 실사공고 제목 1번째 줄 accent 색 (photoTop 전용)
  const kvAccentColor = document.getElementById('kv-title-accent-color');
  const kvAccentColorText = document.getElementById('kv-title-accent-color-text');
  kvAccentColor?.addEventListener('input', (e) => {
    if (kvAccentColorText) kvAccentColorText.value = e.target.value.toUpperCase();
    state.kv.titleAccentColor = e.target.value.toUpperCase();
    renderKvPreview();
  });
  kvAccentColorText?.addEventListener('input', (e) => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      if (kvAccentColor) kvAccentColor.value = v;
      state.kv.titleAccentColor = v.toUpperCase();
      renderKvPreview();
    }
  });

  // 이미지 모서리 라운딩 슬라이더 (실사공고02 전용)
  [['tl', 'TL'], ['tr', 'TR'], ['bl', 'BL'], ['br', 'BR']].forEach(([id, key]) => {
    document.getElementById(`kv-radius-${id}`)?.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      state.kv[`photoRadius${key}`] = v;
      const label = document.getElementById(`kv-radius-${id}-value`);
      if (label) label.textContent = `${v}px`;
      renderKvPreview();
    });
  });

  // 공고번호 상단 위치 슬라이더 (photoTop 전용)
  const kvJobCodeTopSlider = document.getElementById('kv-job-code-top-slider');
  const kvJobCodeTopValue = document.getElementById('kv-job-code-top-value');
  kvJobCodeTopSlider?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    state.kv.photoJobCodeTop = v;
    if (kvJobCodeTopValue) kvJobCodeTopValue.textContent = `${v}%`;
    renderKvPreview();
  });

  // 실사공고05: 이미지 배경 조정 슬라이더
  document.getElementById('kv-photo-bg-size')?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    state.kv.photoBgSize = v;
    const el = document.getElementById('kv-photo-bg-size-value');
    if (el) el.textContent = `${v}%`;
    renderKvPreview();
  });
  document.getElementById('kv-photo-bg-pos-x')?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    state.kv.photoBgPosX = v;
    const el = document.getElementById('kv-photo-bg-pos-x-value');
    if (el) el.textContent = `${v}%`;
    renderKvPreview();
  });
  document.getElementById('kv-photo-bg-pos-y')?.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    state.kv.photoBgPosY = v;
    const el = document.getElementById('kv-photo-bg-pos-y-value');
    if (el) el.textContent = `${v}%`;
    renderKvPreview();
  });

  // 기업명 위쪽 여백 슬라이더
  const _mtHandler = (e) => {
    const v = parseInt(e.target.value, 10);
    state.kv.photoOrgNameMarginTop = `${v}%`;
    const s = document.getElementById('kv-orgName-marginTop');
    const n = document.getElementById('kv-orgName-marginTop-num');
    if (s && s !== e.target) s.value = v;
    if (n && n !== e.target) n.value = v;
    renderKvPreview();
  };
  document.getElementById('kv-orgName-marginTop')?.addEventListener('input', _mtHandler);
  document.getElementById('kv-orgName-marginTop-num')?.addEventListener('input', _mtHandler);

  // 카드 배경색
  const _bgcHandler = (e) => {
    const v = e.target.value;
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
    state.kv.bgColor = v;
    const c = document.getElementById('kv-card-bgcolor');
    const t = document.getElementById('kv-card-bgcolor-text');
    if (c && c !== e.target) c.value = v;
    if (t && t !== e.target) t.value = v;
    renderKvPreview();
  };
  document.getElementById('kv-card-bgcolor')?.addEventListener('input', _bgcHandler);
  document.getElementById('kv-card-bgcolor-text')?.addEventListener('input', _bgcHandler);

  // 텍스트 입력 토글
  document.getElementById('kv-text-inputs-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('kv-text-inputs-body');
    const header = document.getElementById('kv-text-inputs-toggle');
    body?.classList.toggle('hidden');
    header?.classList.toggle('open');
  });

  // 템플릿 설정 토글
  document.getElementById('kv-template-settings-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('kv-template-settings-body');
    const header = document.getElementById('kv-template-settings-toggle');
    body?.classList.toggle('hidden');
    header?.classList.toggle('open');
  });

  // 컬러 설정 토글
  document.getElementById('kv-color-settings-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('kv-color-settings-body');
    const header = document.getElementById('kv-color-settings-toggle');
    body?.classList.toggle('hidden');
    header?.classList.toggle('open');
  });

  // 배경 이미지 설정 토글
  document.getElementById('kv-bg-settings-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('kv-bg-settings-body');
    const header = document.getElementById('kv-bg-settings-toggle');
    body?.classList.toggle('hidden');
    header?.classList.toggle('open');
  });

  // Logo file
  document.getElementById('kv-logo-toggle').addEventListener('click', () => {
    const body = document.getElementById('kv-logo-body');
    const header = document.getElementById('kv-logo-toggle');
    body.classList.toggle('hidden');
    header.classList.toggle('open');
  });

  document.getElementById('kv-logo-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      state.kv.logoDataUrl = ev.target.result;
      const preview = document.getElementById('kv-logo-preview');
      preview.classList.remove('hidden');
      preview.querySelector('img').src = ev.target.result;
      renderKvPreview();
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('kv-logo-remove')?.addEventListener('click', () => {
    state.kv.logoDataUrl = '';
    document.getElementById('kv-logo-preview').classList.add('hidden');
    document.getElementById('kv-logo-file').value = '';
    renderKvPreview();
  });

  // Background image file
  document.getElementById('kv-bg-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const originalKB = Math.round(file.size / 1024);
    const dataUrl = await compressImageFile(file);
    const compressedKB = Math.round(dataUrl.length * 0.75 / 1024); // base64 → 실제 바이트 근사
    state.kv.bgImageDataUrl = dataUrl;
    const preview = document.getElementById('kv-bg-preview');
    preview.classList.remove('hidden');
    preview.querySelector('img').src = dataUrl;
    renderKvPreview();
    if (originalKB > 500 && compressedKB < originalKB) {
      showToast(`이미지 압축 완료: ${originalKB}KB → ${compressedKB}KB`);
    }
  });

  document.getElementById('kv-bg-remove')?.addEventListener('click', () => {
    state.kv.bgImageDataUrl = '';
    document.getElementById('kv-bg-preview').classList.add('hidden');
    document.getElementById('kv-bg-file').value = '';
    renderKvPreview();
  });

  // Background image URL
  document.getElementById('kv-bg-url').addEventListener('input', (e) => {
    state.kv.bgImageUrl = e.target.value;
    debounceKvPreview();
  });

  // Download buttons (sidebar main + preview header)
  document.getElementById('btn-kv-download').addEventListener('click', downloadKvImage);
  document.getElementById('btn-kv-download-preview')?.addEventListener('click', downloadKvImage);

  // Download dropdown
  const dlToggle = document.getElementById('btn-kv-download-toggle');
  const dlDropdown = document.getElementById('kv-download-dropdown');
  if (dlToggle && dlDropdown) {
    dlToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dlDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => dlDropdown.classList.add('hidden'));
    document.querySelectorAll('.kv-download-option').forEach(opt => {
      opt.addEventListener('click', () => {
        dlDropdown.classList.add('hidden');
        const format = opt.dataset.format;
        if (format === 'png2x') downloadKvImage('png', 2);
        else if (format === 'png4x') downloadKvImage('png', 4);
        else if (format === 'jpg') downloadKvImage('jpg', 2);
        else if (format === 'html') downloadKvHtml();
        else if (format === 'server-png2x') downloadKvServerRender('png', 2);
        else if (format === 'server-png4x') downloadKvServerRender('png', 4);
      });
    });
  }

  // OG crop buttons
  document.getElementById('btn-kv-crop-start')?.addEventListener('click', startKvCrop);
  document.getElementById('btn-kv-crop-confirm')?.addEventListener('click', confirmKvCrop);
  document.getElementById('btn-kv-crop-cancel')?.addEventListener('click', cancelKvCrop);

  // Company search toggle
  document.getElementById('kv-company-search-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('kv-company-search-body');
    const header = document.getElementById('kv-company-search-toggle');
    body?.classList.toggle('hidden');
    header?.classList.toggle('open');

    // 패널 열릴 때 현재 기업명을 검색어로 자동 입력
    if (!body?.classList.contains('hidden')) {
      const input = document.getElementById('kv-company-keyword');
      if (input && !input.value.trim() && state.kv.companyName && state.kv.companyName !== '기업명') {
        input.value = state.kv.companyName;
      }
      input?.focus();
    }
  });

  // Company search button + Enter key
  document.getElementById('btn-kv-company-search')?.addEventListener('click', () => {
    const kw = document.getElementById('kv-company-keyword')?.value.trim();
    if (kw) searchIncruitCompany(kw);
  });
  document.getElementById('kv-company-keyword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const kw = e.target.value.trim();
      if (kw) searchIncruitCompany(kw);
    }
  });

  // Image search toggle
  document.getElementById('kv-img-search-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('kv-img-search-body');
    const header = document.getElementById('kv-img-search-toggle');
    body?.classList.toggle('hidden');
    header?.classList.toggle('open');

    // 검색창이 열릴 때 키워드가 비어있으면 소스 텍스트 기반 영어 키워드 제안
    if (!body?.classList.contains('hidden')) {
      const input = document.getElementById('kv-img-keyword');
      if (input && !input.value.trim()) {
        const sourceText = (elements.sourceEditor?.innerText || '').trim();
        input.value = suggestImageKeyword(sourceText);
      }
    }
  });

  // Image search button + Enter key
  document.getElementById('btn-kv-img-search')?.addEventListener('click', searchKvImages);
  document.getElementById('kv-img-keyword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchKvImages(); }
  });

  // Image search settings link
  document.getElementById('kv-img-open-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAiSettingsModal();
  });

  // Initialize image search key warning
  updateImgSearchKeyWarning();

  // Image DB panel toggle
  document.getElementById('kv-imgdb-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('kv-imgdb-body');
    const header = document.getElementById('kv-imgdb-toggle');
    body?.classList.toggle('hidden');
    header?.classList.toggle('open');
    if (!body?.classList.contains('hidden')) refreshImageDBGrid();
  });

  // Image DB upload (drag & drop + file input)
  const dropZone = document.getElementById('imagedb-drop-zone');
  const fileInput = document.getElementById('imagedb-file-input');
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      handleImageDBUpload(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) handleImageDBUpload(fileInput.files);
      fileInput.value = '';
    });
  }

  // Image DB filter
  document.getElementById('imagedb-filter-category')?.addEventListener('change', refreshImageDBGrid);

  // Image DB export/import
  document.getElementById('btn-imagedb-export')?.addEventListener('click', handleImageDBExport);
  document.getElementById('imagedb-import-file')?.addEventListener('change', handleImageDBImport);

  // Figma panel toggle
  document.getElementById('kv-figma-toggle')?.addEventListener('click', () => {
    const body = document.getElementById('kv-figma-body');
    const header = document.getElementById('kv-figma-toggle');
    body?.classList.toggle('hidden');
    header?.classList.toggle('open');
    updateFigmaTokenWarning();
  });

  // Figma load + import
  document.getElementById('btn-figma-load')?.addEventListener('click', handleFigmaLoad);
  document.getElementById('btn-figma-import')?.addEventListener('click', handleFigmaImport);
  document.getElementById('btn-figma-vars-load')?.addEventListener('click', handleFigmaVariablesLoad);
  document.getElementById('figma-open-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    openAiSettingsModal();
  });

  // Initialize Image DB
  imageDB.openDB().catch(err => console.warn('[ImageDB] 초기화 실패:', err));

  // Reset button
  document.getElementById('btn-kv-reset').addEventListener('click', resetKv);

  // 추가 액션 버튼
  document.getElementById('btn-kv-copy-image')?.addEventListener('click', copyKvToClipboard);
  document.getElementById('btn-kv-preview-popup')?.addEventListener('click', openKvPreviewPopup);
  document.getElementById('btn-kv-autofill')?.addEventListener('click', forceAutoFillKv);

  // Preset selection
  document.querySelectorAll('.kv-preset-card').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.kv-preset-card').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyKvPreset(btn.dataset.preset);
    });
  });

  // Auto-fit toggle
  document.getElementById('kv-title-autofit')?.addEventListener('change', () => renderKvPreview());

  // Rich text color toolbar
  setupKvTitleColorToolbar();
  setupKvOrgNameColorToolbar();

  // ---- 초기 KV UI 동기화 ----
  // KV 토글 체크 상태를 state 기준으로 초기화
  if (kvToggle) kvToggle.checked = state.kvEnabled;

  // 프리셋 복원 (저장된 presetKey 또는 기본값 photoAnnounce01)
  const initPresetKey = state.kv.presetKey || 'photoAnnounce01';
  applyKvPreset(initPresetKey);
  document.querySelectorAll('.kv-preset-card').forEach(b => b.classList.toggle('active', b.dataset.preset === initPresetKey));
  // Split layout 복원
  if (state.kv.splitLayout) {
    document.querySelectorAll('[data-kv-split-layout]').forEach(b => b.classList.toggle('active', b.dataset.kvSplitLayout === state.kv.splitLayout));
  }
  // Split layout 그룹 표시/숨김
  const splitLayoutGroup = document.getElementById('kv-split-layout-group');
  if (splitLayoutGroup) splitLayoutGroup.style.display = state.kv.templateType === 'split' ? '' : 'none';
  // 템플릿 타입 버튼 동기화
  document.querySelectorAll('[data-kv-type]').forEach(b => b.classList.toggle('active', b.dataset.kvType === state.kv.templateType));
  // 텍스트 정렬 버튼 동기화
  document.querySelectorAll('[data-kv-align]').forEach(b => b.classList.toggle('active', b.dataset.kvAlign === state.kv.textAlign));
  // 효과 버튼 동기화
  document.querySelectorAll('[data-kv-effect]').forEach(b => b.classList.toggle('active', b.dataset.kvEffect === state.kv.effect));

  renderKvPreview();
  syncKvVisibility();
  syncNonKvFieldsVisibility();
}

// ── KV Title Color Toolbar ──
function setupKvTitleColorToolbar() {
  const editor = document.getElementById('kv-title');
  const toolbar = document.getElementById('kv-title-color-toolbar');
  if (!editor || !toolbar) return;

  // Enter → <br> 삽입: 모든 kv-rich-editor에 공통 적용 (contenteditable 기본 <div> 생성 방지)
  document.querySelectorAll('.kv-rich-editor').forEach(ed => {
    if (ed.dataset.brSetup) return; // 중복 방지
    ed.dataset.brSetup = 'true';
    ed.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // DOM 직접 조작으로 <br> 삽입 (execCommand보다 안정적)
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const br = document.createElement('br');
        range.insertNode(br);
        // 빈 줄 끝에서 커서 이동을 위한 trailing br (브라우저 호환)
        if (!br.nextSibling || br.nextSibling.nodeName === 'BR') {
          const trailingBr = document.createElement('br');
          br.parentNode.insertBefore(trailingBr, br.nextSibling);
        }
        // 커서를 <br> 다음으로 이동
        range.setStartAfter(br);
        range.setEndAfter(br);
        sel.removeAllRanges();
        sel.addRange(range);
        // state 동기화 후 미리보기 갱신
        syncKvState();
        debounceKvPreview();
      }
    });
  });

  // 선택 영역 → 툴바 표시/숨김
  let savedRange = null;
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
      toolbar.classList.remove('hidden');
    } else if (!toolbar.matches(':hover') && document.activeElement !== editor) {
      toolbar.classList.add('hidden');
    }
  });
  editor.addEventListener('blur', () => {
    setTimeout(() => {
      if (!toolbar.matches(':hover')) toolbar.classList.add('hidden');
    }, 200);
  });

  // 툴바 버튼 클릭 전에 selection을 복원하는 헬퍼
  function restoreSelection() {
    if (!savedRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }

  // 색상 스와치 버튼
  toolbar.querySelectorAll('.kv-color-swatch').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      restoreSelection();
      applyKvTitleColor(btn.dataset.color);
    });
  });

  // 커스텀 컬러 피커
  const colorPicker = document.getElementById('kv-title-color-picker');
  colorPicker?.addEventListener('mousedown', () => { restoreSelection(); });
  colorPicker?.addEventListener('input', e => {
    applyKvTitleColor(e.target.value);
  });

  // 색상 제거 버튼
  document.getElementById('kv-title-color-clear')?.addEventListener('mousedown', e => {
    e.preventDefault();
    restoreSelection();
    clearKvTitleColor();
  });

  // 그라데이션 적용 버튼
  document.getElementById('kv-grad-apply')?.addEventListener('mousedown', e => {
    e.preventDefault();
    restoreSelection();
    const start = document.getElementById('kv-grad-start')?.value || '#CC1111';
    const end = document.getElementById('kv-grad-end')?.value || '#FF6600';
    const dir = document.getElementById('kv-grad-direction')?.value || '90deg';
    applyKvTitleGradient(start, end, dir);
  });

  // 그라데이션 프리셋 스와치
  toolbar.querySelectorAll('.kv-grad-swatch').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      restoreSelection();
      applyKvTitleGradientRaw(btn.dataset.grad);
    });
  });
}

function setupKvOrgNameColorToolbar() {
  const editor = document.getElementById('kv-org-name');
  const toolbar = document.getElementById('kv-org-name-color-toolbar');
  if (!editor || !toolbar) return;

  let savedRange = null;
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
      toolbar.classList.remove('hidden');
    } else if (!toolbar.matches(':hover') && document.activeElement !== editor) {
      toolbar.classList.add('hidden');
    }
  });
  editor.addEventListener('blur', () => {
    setTimeout(() => { if (!toolbar.matches(':hover')) toolbar.classList.add('hidden'); }, 200);
  });

  function restoreSelection() {
    if (!savedRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }

  toolbar.querySelectorAll('.kv-color-swatch').forEach(btn => {
    btn.addEventListener('mousedown', e => { e.preventDefault(); restoreSelection(); applyRichEditorColor(editor, btn.dataset.color); });
  });

  const colorPicker = toolbar.querySelector('.kv-rich-color-picker');
  colorPicker?.addEventListener('mousedown', () => { restoreSelection(); });
  colorPicker?.addEventListener('input', e => { applyRichEditorColor(editor, e.target.value); });

  toolbar.querySelector('.kv-rich-color-clear')?.addEventListener('mousedown', e => {
    e.preventDefault(); restoreSelection(); clearRichEditorColor(editor);
  });

  toolbar.querySelector('.kv-rich-grad-apply')?.addEventListener('mousedown', e => {
    e.preventDefault(); restoreSelection();
    const start = toolbar.querySelector('.kv-rich-grad-start')?.value || '#CC1111';
    const end = toolbar.querySelector('.kv-rich-grad-end')?.value || '#FF6600';
    const dir = toolbar.querySelector('.kv-rich-grad-direction')?.value || '90deg';
    applyRichEditorGradient(editor, start, end, dir);
  });

  toolbar.querySelectorAll('.kv-grad-swatch').forEach(btn => {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      restoreSelection();
      applyRichEditorGradientRaw(editor, btn.dataset.grad);
    });
  });

  editor.addEventListener('input', () => { syncKvState(); renderKvPreview(); });
}

function applyRichEditorColor(editor, color) {
  // 통합 헬퍼 사용: 기존 스타일 span이 있으면 style만 교체, 없으면 신규 wrap.
  // 이전 gradient/color span을 그대로 둔 채 새 wrap을 만들면 부모의 text-fill:transparent에
  // 눌려서 안 보이던 문제 해결.
  if (_applyStyledSpan(editor, `color:${color};`)) { syncKvState(); renderKvPreview(); }
}

function clearRichEditorColor(editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  if (!editor.contains(sel.anchorNode)) return;
  const range = sel.getRangeAt(0);
  const text = range.toString();
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  syncKvState(); renderKvPreview();
}

// 선택된 텍스트의 가장 가까운 "인라인 스타일 span" 조상을 반환.
// 에디터가 생성하는 스타일 span(class 없이 style만 있는 span)만 매치 —
// 단색, 그라데이션, 배경 등 어떤 스타일이든 동일하게 교체 가능.
function _getAncestorStyledSpan(node, editor) {
  let n = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (n && editor.contains(n) && n !== editor) {
    if (n.tagName === 'SPAN' && n.style && n.style.cssText && !n.hasAttribute('class')) return n;
    n = n.parentElement;
  }
  return null;
}

/**
 * 선택 범위에 인라인 style을 적용.
 * 선택이 이미 존재하는 스타일 span의 전체 텍스트와 일치하면 새 span 없이
 * 기존 span의 style.cssText를 교체 — 단색↔그라데이션 등 연속 적용 시
 * span이 중첩되지 않도록 한다.
 */
function _applyStyledSpan(editor, styleCss) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  if (!editor.contains(sel.anchorNode)) return false;
  const range = sel.getRangeAt(0);

  // 선택이 기존 스타일 span 안에 있으면(전체/부분 무관): 그 span의 style을 교체.
  // 부분만 선택하고 wrap 경로로 가면 내부 새 span이 부모 gradient의 text-fill:transparent에
  // 가려서 "단색/그라데이션 교체가 안 먹히는" 증상이 생김 — KV 짧은 필드엔 span 전체 교체가 직관적.
  const existing = _getAncestorStyledSpan(range.startContainer, editor);
  if (existing && existing.contains(range.endContainer)) {
    existing.style.cssText = styleCss;
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(existing);
    sel.addRange(r);
    return true;
  }

  // 신규 wrap
  const span = document.createElement('span');
  span.style.cssText = styleCss;
  try {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
    return true;
  } catch(e) { console.warn('_applyStyledSpan error:', e); return false; }
}

// 뒤 호환: 그라데이션 전용 alias (기존 호출부 영향 없음)
const _applyGradientSpanStyle = _applyStyledSpan;

function _buildGradientSpanStyle(editorFont, background) {
  // background shorthand 대신 background-image 롱핸드 사용.
  // Chrome이 `background: linear-gradient(...); background-clip: text`를
  // `background: linear-gradient(...) text` 신규 shorthand로 정규화해 읽는데,
  // modern-screenshot 등 일부 캡처 라이브러리가 이 신규 문법을 파싱 못해
  // background-clip 정보가 유실되어 gradient 텍스트가 보이지 않는 증상 방지.
  return `background-image:${background};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:inline-block;padding:0;line-height:inherit;box-decoration-break:clone;-webkit-box-decoration-break:clone;font-family:${editorFont};`;
}

function applyRichEditorGradient(editor, startColor, endColor, direction) {
  const editorFont = window.getComputedStyle(editor).fontFamily;
  // 강원교육튼튼체 등 특정 폰트에서 그라데이션 짤림 방지: padding 유지 + 폰트 명시
  const style = _buildGradientSpanStyle(editorFont, `linear-gradient(${direction},${startColor},${endColor})`);
  if (_applyGradientSpanStyle(editor, style)) { syncKvState(); renderKvPreview(); }
}

function applyRichEditorGradientRaw(editor, gradientCss) {
  const editorFont = window.getComputedStyle(editor).fontFamily;
  const style = _buildGradientSpanStyle(editorFont, gradientCss);
  if (_applyGradientSpanStyle(editor, style)) { syncKvState(); renderKvPreview(); }
}

function applyKvTitleGradientRaw(gradientCss) {
  const editor = document.getElementById('kv-title');
  if (!editor) return;
  const editorFont = window.getComputedStyle(editor).fontFamily;
  const style = _buildGradientSpanStyle(editorFont, gradientCss);
  if (_applyGradientSpanStyle(editor, style)) { syncKvState(); renderKvPreview(); }
}

function applyKvTitleGradient(startColor, endColor, direction) {
  const editor = document.getElementById('kv-title');
  if (!editor) return;
  const editorFont = window.getComputedStyle(editor).fontFamily;
  const style = _buildGradientSpanStyle(editorFont, `linear-gradient(${direction},${startColor},${endColor})`);
  if (_applyGradientSpanStyle(editor, style)) { syncKvState(); renderKvPreview(); }
}

function applyKvTitleColor(color) {
  const editor = document.getElementById('kv-title');
  if (!editor) return;
  if (_applyStyledSpan(editor, `color:${color};`)) { syncKvState(); renderKvPreview(); }
}

function clearKvTitleColor() {
  const editor = document.getElementById('kv-title');
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  if (!editor.contains(sel.anchorNode)) return;

  const range = sel.getRangeAt(0);
  const text = range.toString();
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  syncKvState();
  renderKvPreview();
}

// ============================================
// Shared AI Assistant Setup
// ============================================
function setupSharedAiAssistant() {
  const header = document.getElementById('ai-assistant-toggle');
  const body = document.getElementById('ai-assistant-body');
  const input = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-chat-send');
  const fileInput = document.getElementById('ai-file-input');
  const fileLabel = document.getElementById('ai-file-label');
  const fileNameSpan = document.getElementById('ai-file-name');

  // 새 UI 요소들
  const fileChip = document.getElementById('ai-file-chip');
  const fileChipText = document.getElementById('ai-file-chip-text');
  const fileChipRemove = document.getElementById('ai-file-chip-remove');

  if (!header || !body) return;

  // Toggle open/close
  header.addEventListener('click', (e) => {
    // Don't toggle when clicking gear button
    if (e.target.closest('.ai-gear-btn')) return;
    body.classList.toggle('hidden');
    header.classList.toggle('open');
  });

  // File upload
  let attachedFileText = '';
  let attachedFileMention = '';
  let currentSendAction = 'send';
  let attachedFiles = []; // 다중 파일 (HWP+PDF 조합용)

  const sendBtnIconDefault = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg>';
  const sendBtnIconStop = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

  function setSendButtonLoading(isLoading) {
    if (!sendBtn) return;
    if (isLoading) {
      sendBtn.innerHTML = sendBtnIconStop;
      sendBtn.classList.add('loading');
      sendBtn.disabled = false;
      sendBtn.title = 'AI 응답 중지';
    } else {
      sendBtn.classList.remove('loading');
      sendBtn.innerHTML = sendBtnIconDefault;
      sendBtn.title = '전송';
    }
  }

  function triggerSelectedAction() {
    const action = currentSendAction;
    // 사용 후 기본 액션으로 복원 (한 번만 실행)
    currentSendAction = 'send';

    // HWP+PDF / DOCX+PDF 조합이 첨부된 상태에서 변환 액션 → combinedVision 우선 실행
    const hwpFile = attachedFiles.find(f => ['hwp', 'hwpx'].includes(f.name.split('.').pop().toLowerCase()));
    const docxFile = attachedFiles.find(f => ['doc', 'docx'].includes(f.name.split('.').pop().toLowerCase()));
    const pdfFile = attachedFiles.find(f => f.name.split('.').pop().toLowerCase() === 'pdf');
    if (hwpFile && pdfFile && ['convert', 'send'].includes(action)) {
      const inputText = input.value.trim();
      const displayMsg = inputText
        ? `@${hwpFile.name} + @${pdfFile.name} ${inputText}`
        : `@${hwpFile.name} + @${pdfFile.name} Vision 변환`;
      addMessage('user', displayMsg);
      input.value = '';
      input.style.height = 'auto';
      const hw = hwpFile, pd = pdfFile;
      clearFileAttachment();
      handleHwpPdfCombinedVision(hw, pd);
      return;
    }
    if (docxFile && pdfFile && ['convert', 'send'].includes(action)) {
      const inputText = input.value.trim();
      const displayMsg = inputText
        ? `@${docxFile.name} + @${pdfFile.name} ${inputText}`
        : `@${docxFile.name} + @${pdfFile.name} Vision 변환`;
      addMessage('user', displayMsg);
      input.value = '';
      input.style.height = 'auto';
      const dx = docxFile, pd = pdfFile;
      clearFileAttachment();
      handleDocxPdfCombined(dx, pd);
      return;
    }

    if (['convert', 'verify', 'summarize', 'competencies'].includes(action)) {
      // 채팅 입력 내용을 먼저 채팅방에 표시
      const inputText = input.value.trim();
      const chipText = attachedFileMention || '';
      const actionLabels = { convert: '채용공고 변환', verify: '검증하기', summarize: '공고 요약', competencies: '핵심 역량 분석' };
      const displayMsg = (chipText && inputText) ? `${chipText} ${inputText}`
                       : chipText ? `${chipText} ${actionLabels[action]}`
                       : inputText || actionLabels[action];
      addMessage('user', displayMsg);
      input.value = '';
      input.style.height = 'auto';
      clearFileAttachment();
      handleQuickAction(action);
      return;
    }

    handleAiSend().catch(e => {
      console.error('[app] handleAiSend 미처리 오류:', e);
      state.isLoading = false;
      state._loadingWsId = null;
      if (sendBtn) sendBtn.disabled = !(input.value.trim() || attachedFileText);
      setSendButtonLoading(false);
    });
  }

  // 파일 칩 제거 버튼
  if (fileChipRemove) {
    fileChipRemove.addEventListener('click', () => {
      clearFileAttachment();
    });
  }

  function showFileChip(filename, sizeKb) {
    if (fileChip && fileChipText) {
      fileChipText.textContent = `@${filename} (${sizeKb}KB)`;
      fileChip.classList.remove('hidden');
    }
  }

  function hideFileChip() {
    if (fileChip) {
      fileChip.classList.add('hidden');
    }
  }

  function clearFileAttachment() {
    attachedFileText = '';
    attachedFileMention = '';
    attachedFiles = [];
    hideFileChip();
    if (fileNameSpan) fileNameSpan.textContent = '';
    if (fileInput) fileInput.value = '';
    const fileDrop = document.getElementById('ai-file-drop');
    if (fileDrop) fileDrop.classList.add('hidden');
    // 기본 액션으로 복원
    currentSendAction = 'send';
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      if (files.length >= 2) {
        handleMultiFileAttach(files);
      } else {
        handleFileAttach(files[0]);
      }
    });
  }

  // Drag & drop
  if (fileLabel) {
    fileLabel.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileLabel.classList.add('drag-over');
    });
    fileLabel.addEventListener('dragleave', () => {
      fileLabel.classList.remove('drag-over');
    });
    fileLabel.addEventListener('drop', (e) => {
      e.preventDefault();
      fileLabel.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;
      if (files.length >= 2) {
        handleMultiFileAttach(files);
      } else {
        handleFileAttach(files[0]);
      }
    });
  }

  /** HWP+PDF, DOCX+PDF 조합 등 다중 파일 첨부 처리 */
  async function handleMultiFileAttach(files) {
    const hwpFile = files.find(f => ['hwp', 'hwpx'].includes(f.name.split('.').pop().toLowerCase()));
    const docxFile = files.find(f => ['doc', 'docx'].includes(f.name.split('.').pop().toLowerCase()));
    const pdfFile = files.find(f => f.name.split('.').pop().toLowerCase() === 'pdf');

    if (hwpFile && pdfFile) {
      // HWP + PDF 조합 감지
      attachedFiles = [hwpFile, pdfFile];
      const totalKb = ((hwpFile.size + pdfFile.size) / 1024).toFixed(0);
      attachedFileMention = `@${hwpFile.name} + @${pdfFile.name}`;
      showFileChip(`${hwpFile.name} + ${pdfFile.name}`, totalKb);
      currentSendAction = 'convert';
      if (sendBtn) sendBtn.disabled = false;

      const comboBtnMsg = document.createElement('div');
      comboBtnMsg.className = 'message assistant-message';
      comboBtnMsg.innerHTML = `
        <div style="margin-top:4px">
          <p style="margin:0 0 8px;font-size:0.9em;opacity:0.85;">
            📎 <strong>${hwpFile.name}</strong> + <strong>${pdfFile.name}</strong> 조합이 감지됐습니다.
          </p>
          <p style="margin:0 0 10px;font-size:0.85em;opacity:0.7;">
            HWP의 정확한 텍스트 구조 + PDF의 색상·정렬 서식을 함께 반영합니다.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <button id="hwpPdfVisionBtn" style="
              padding:6px 14px;border-radius:6px;border:none;cursor:pointer;
              background:linear-gradient(135deg,#4285f4,#0f9d58);color:#fff;
              font-size:0.85em;font-weight:600;letter-spacing:0.02em;
            ">🖼️ HWP+PDF Vision 변환</button>
            <span style="font-size:0.75em;opacity:0.6;">HWP 구조 + PDF 이미지 → Gemini Vision (API 키 필요)</span>
          </div>
        </div>`;
      const chatArea = document.getElementById('chatMessages') || document.querySelector('.chat-messages');
      if (chatArea) {
        chatArea.appendChild(comboBtnMsg);
        chatArea.scrollTop = chatArea.scrollHeight;
        comboBtnMsg.querySelector('#hwpPdfVisionBtn').addEventListener('click', () => {
          comboBtnMsg.remove();
          handleHwpPdfCombinedVision(hwpFile, pdfFile);
        });
      }
    } else if (docxFile && pdfFile) {
      // DOCX + PDF 조합 감지
      attachedFiles = [docxFile, pdfFile];
      const totalKb = ((docxFile.size + pdfFile.size) / 1024).toFixed(0);
      attachedFileMention = `@${docxFile.name} + @${pdfFile.name}`;
      showFileChip(`${docxFile.name} + ${pdfFile.name}`, totalKb);
      currentSendAction = 'convert';
      if (sendBtn) sendBtn.disabled = false;

      const comboBtnMsg2 = document.createElement('div');
      comboBtnMsg2.className = 'message assistant-message';
      comboBtnMsg2.innerHTML = `
        <div style="margin-top:4px">
          <p style="margin:0 0 8px;font-size:0.9em;opacity:0.85;">
            📎 <strong>${docxFile.name}</strong> + <strong>${pdfFile.name}</strong> 조합이 감지됐습니다.
          </p>
          <p style="margin:0 0 10px;font-size:0.85em;opacity:0.7;">
            Word 문서의 텍스트를 100% 기준으로, PDF의 색상·볼드·밑줄·정렬·블릿 스타일을 반영합니다.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <button id="docxPdfVisionBtn" style="
              padding:6px 14px;border-radius:6px;border:none;cursor:pointer;
              background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;
              font-size:0.85em;font-weight:600;letter-spacing:0.02em;
            ">🖼️ Word+PDF Vision 변환</button>
            <span style="font-size:0.75em;opacity:0.6;">Word 텍스트 기준 + PDF 서식 → Gemini Vision (API 키 필요)</span>
          </div>
        </div>`;
      const chatArea2 = document.getElementById('chatMessages') || document.querySelector('.chat-messages');
      if (chatArea2) {
        chatArea2.appendChild(comboBtnMsg2);
        chatArea2.scrollTop = chatArea2.scrollHeight;
        comboBtnMsg2.querySelector('#docxPdfVisionBtn').addEventListener('click', () => {
          comboBtnMsg2.remove();
          handleDocxPdfCombined(docxFile, pdfFile);
        });
      }
    } else {
      // 조합 아님 — 첫 번째 파일만 처리
      handleFileAttach(files[0]);
      if (files.length > 1) {
        addMessage('assistant', `💡 Word+PDF 또는 HWP+PDF 조합을 동시에 첨부하면 색상·정렬까지 반영하는 Vision 변환이 가능합니다.`);
      }
    }
  }

  async function handleFileAttach(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      addMessage('assistant', '파일 크기가 10MB를 초과합니다. 더 작은 파일을 사용해주세요.');
      return;
    }

    const fileSizeKb = (file.size / 1024).toFixed(1);
    if (fileNameSpan) fileNameSpan.innerHTML = `📎 ${file.name} (${fileSizeKb}KB)`;

    // 파일 칩 표시 (textarea 안)
    attachedFileMention = `@${file.name} (${fileSizeKb}KB)`;
    showFileChip(file.name, fileSizeKb);

    // 파일 첨부 시 기본 액션을 변환으로 설정
    currentSendAction = 'convert';
    if (sendBtn) sendBtn.disabled = false;

    try {
      const ext = file.name.split('.').pop().toLowerCase();

      if (['txt', 'html', 'htm', 'csv'].includes(ext)) {
        attachedFileText = await file.text();
        const fileHtml = ext === 'html' || ext === 'htm'
          ? attachedFileText
          : `<pre>${attachedFileText.replace(/</g, '&lt;')}</pre>`;
        saveOriginalSource('file', fileHtml, { filename: file.name, size: file.size, format: ext });
        populateOriginalViewer();
        setViewAndActivateTab('original');
        addMessage('assistant', `✓ "${file.name}" 파일을 읽었습니다 (${(file.size / 1024).toFixed(1)}KB). 보내기를 누르면 변환을 시작합니다.`);
      } else {
        // 바이너리 파일 (PDF, DOC, HWP, HWPX, XLS) — fileExtractor 사용
        addMessage('assistant', `⏳ "${file.name}" 변환 중...`);

        // PDF 업로드 시 HWP 원본 권장 안내
        if (ext === 'pdf') {
          addMessage('assistant', '💡 PDF에서 추출 시 테이블이나 특수문자(○●■① 등)가 깨질 수 있습니다. 원본 HWP 파일이 있으면 HWP로 업로드하시면 더 정확합니다.');
        }

        // HWP/HWPX: 백엔드(LibreOffice) 우선 → 브라우저 폴백
        // 기타: 브라우저 우선 → 백엔드 폴백
        const isHwp = ['hwp', 'hwpx'].includes(ext);

        try {
          let result = null;
          let source = '';

          if (isHwp) {
            // HWP: 백엔드 우선 (LibreOffice → DOCX → HTML, 테이블 보존)
            if (state.convertServerAvailable) {
              try {
                const backendResult = await extractViaBackend(file);
                if (backendResult.html && (backendResult.text?.length > 0 || backendResult.html.length > 10)) {
                  result = backendResult;
                  source = '서버(LibreOffice)';
                }
              } catch (e) { console.warn('[HWP] 백엔드 변환 실패, 브라우저 폴백:', e.message); }
            }

            if (!result) {
              result = await extractFromFile(file);
              source = '브라우저';
            }
          } else {
            // 기타 파일: 브라우저 우선
            try {
              result = await extractFromFile(file);
              source = '브라우저';

              // PDF 품질 검증: 추출 텍스트가 너무 짧으면 백엔드도 시도
              if (ext === 'pdf') {
                const textLen = (result.text || stripHtmlSimple(result.html) || '').length;
                if (textLen < 200) {
                  console.log(`[PDF] 브라우저 추출 결과 짧음 (${textLen}자), 백엔드 시도`);
                  try {
                    const backendResult = await extractViaBackend(file);
                    const backendTextLen = (backendResult.text || '').length;
                    if (backendTextLen > textLen) {
                      result = backendResult;
                      source = '서버(pdfplumber)';
                      console.log(`[PDF] 백엔드 결과 채택 (${backendTextLen}자 > ${textLen}자)`);
                    }
                  } catch (e) { console.warn('[PDF] 백엔드 품질 폴백 실패:', e.message); }
                }
              }
            } catch (extractErr) {
              const backendResult = await extractViaBackend(file);
              if (backendResult.html) {
                result = backendResult;
                source = '서버';
              } else {
                throw extractErr;
              }
            }
          }

          attachedFileText = result.text || stripHtmlSimple(result.html);
          // 파일 로드 시 서식 정보를 state에 저장 (Vision 변환 시 재활용)
          const _meta = result.metadata || {};
          if (_meta.bold_texts || _meta.underline_texts || _meta.bullet_items) {
            state.formattingInfo = {
              boldTexts: _meta.bold_texts || [],
              underlineTexts: _meta.underline_texts || [],
              bulletItems: _meta.bullet_items || []
            };
          } else {
            state.formattingInfo = null;
          }
          if (result.html && result.html.length > 50) {
            const warnMsg = result.warnings?.length
              ? '\n⚠ ' + result.warnings.join('\n⚠ ')
              : (_meta.warnings?.length
                ? '\n⚠ ' + _meta.warnings.join('\n⚠ ')
                : '');
            const convPath = _meta.conversion_path
              ? `\n📋 변환 경로: ${_meta.conversion_path}`
              : '';
            addMessage('assistant', `✓ "${file.name}" 파일에서 내용을 추출했습니다 (${source}).${convPath}${warnMsg}\n보내기를 누르면 변환을 시작합니다.`);
            saveOriginalSource('file', result.html, {
              filename: file.name, size: file.size, format: ext,
              ...(result.metadata || {})
            });
            populateOriginalViewer();
            setViewAndActivateTab('original');

            // PDF: 페이지 이미지 백그라운드 렌더링 (Vision 교차 비교용)
            if (ext === 'pdf') {
              state.pdfPageImages = [];
              state.attachedPdfBase64 = null;
              fileToBase64(file).then(b64 => {
                state.attachedPdfBase64 = b64;
                return pdfBase64ToImages(b64, 10);
              }).then(({ images, totalPages }) => {
                state.pdfPageImages = images;
                console.log(`[PDF Vision] ${images.length}/${totalPages}페이지 이미지 렌더링 완료`);
              }).catch(e => {
                console.warn('[PDF Vision] 이미지 렌더링 실패:', e.message);
              });
            }

            // Vision 변환 옵션 버튼 제공
            // - PDF: 서버 불필요, 항상 지원
            // - HWP/HWPX/DOCX/DOC: 서버 필요
            const supportsVision = ext === 'pdf' || (
              ['hwp', 'hwpx', 'docx', 'doc'].includes(ext) && state.convertServerAvailable
            );
            const supportsRawHtml = isHwp && state.convertServerAvailable;

            if (supportsVision || supportsRawHtml) {
              const optBtnMsg = document.createElement('div');
              optBtnMsg.className = 'message assistant-message';

              const rawHtmlBtnHtml = supportsRawHtml ? `
                    <button id="rawHtmlBtn" style="
                      padding:6px 14px;border-radius:6px;border:none;cursor:pointer;
                      background:linear-gradient(135deg,#f5a623,#e8780c);color:#fff;
                      font-size:0.85em;font-weight:600;letter-spacing:0.02em;
                    ">📄 원문 HTML 추출</button>
                    <span style="font-size:0.75em;opacity:0.6;">AI 없이 LibreOffice로 HTML 변환</span>` : '';

              optBtnMsg.innerHTML = `
                <div style="margin-top:4px">
                  <p style="margin:0 0 8px;font-size:0.9em;opacity:0.85;">
                    🖼️ 색상·정렬까지 반영하려면 <strong>Vision 변환</strong>을 사용하세요:
                  </p>
                  <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
                    ${rawHtmlBtnHtml}
                    <button id="visionConvertBtn" style="
                      padding:6px 14px;border-radius:6px;border:none;cursor:pointer;
                      background:linear-gradient(135deg,#4285f4,#0f9d58);color:#fff;
                      font-size:0.85em;font-weight:600;letter-spacing:0.02em;
                    ">🖼️ Vision 변환</button>
                    <span style="font-size:0.75em;opacity:0.6;">문서를 이미지로 캡처해 Gemini Vision 분석 (API 키 필요)</span>
                  </div>
                </div>`;
              const chatArea = document.getElementById('chatMessages') || document.querySelector('.chat-messages');
              if (chatArea) {
                chatArea.appendChild(optBtnMsg);
                chatArea.scrollTop = chatArea.scrollHeight;
                optBtnMsg.querySelector('#rawHtmlBtn')?.addEventListener('click', () => {
                  optBtnMsg.remove();
                  handleRawHtmlConvert(file);
                });
                optBtnMsg.querySelector('#visionConvertBtn')?.addEventListener('click', () => {
                  optBtnMsg.remove();
                  handleVisionConvert(file);
                });
              }
            }
          } else {
            addMessage('assistant', `⚠ "${file.name}" 파일에서 충분한 내용을 추출하지 못했습니다. 파일 내용을 직접 복사하여 입력해주세요.`);
            attachedFileText = '';
            hideFileChip();
          }
        } catch (err) {
          addMessage('assistant', `⚠ "${file.name}" 변환 실패: ${err.message}\n파일 내용을 직접 복사하여 입력해주세요.`);
          attachedFileText = '';
          hideFileChip();
        }
      }
    } catch (err) {
      addMessage('assistant', `파일 읽기 실패: ${err.message}`);
    }
  }

  // 백엔드 변환 서버 폴백 (60초 타임아웃)
  async function extractViaBackend(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);

    // Claude API 키 전달 (Vision 변환용)
    const claudeKey = localStorage.getItem('ai_api_key_claude') || localStorage.getItem('ai_api_key') || '';
    if (claudeKey) formData.append('anthropic_api_key', claudeKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      let convertUrl = `${CONVERT_SERVER_URL}/api/convert`;
      if (options.parser) convertUrl += `?parser=${encodeURIComponent(options.parser)}`;
      const resp = await fetch(convertUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!resp.ok) throw new Error(`백엔드 서버 응답 오류 (${resp.status})`);
      return resp.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('백엔드 서버 응답 시간 초과 (60초). 브라우저 추출로 전환합니다.');
      }
      throw err;
    }
  }

  function stripHtmlSimple(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }

  /**
   * 네이티브 파서 HTML에 깨진 테이블이 있는지 감지
   * 패턴 1: 빈 행이 2개+ (셀 구조 깨짐)
   * 패턴 2: 테이블 바로 뒤에 테이블 내용이 <p>로 떨어져 나옴
   */
  function _hasBrokenTables(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    const tables = div.querySelectorAll('table');
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      if (rows.length < 2) continue;

      // 패턴 1: 빈 행 감지
      let emptyCount = 0;
      for (const row of rows) {
        const cells = row.querySelectorAll('td, th');
        const hasContent = Array.from(cells).some(c => c.textContent.trim().length > 0);
        if (!hasContent) emptyCount++;
      }
      if (emptyCount >= 2) {
        console.log(`[HWP] 깨진 테이블 감지(빈행): ${rows.length}행 중 ${emptyCount}행 빈`);
        return true;
      }
    }
    return false;
  }

  /**
   * 네이티브 HTML의 깨진 테이블을 LibreOffice 테이블로 교체
   * - 네이티브 텍스트(서식 포함)는 유지
   * - 테이블만 LibreOffice 결과에서 가져옴
   */
  function _mergeNativeWithLoTables(nativeHtml, loHtml) {
    const nativeDiv = document.createElement('div');
    nativeDiv.innerHTML = nativeHtml;
    const loDiv = document.createElement('div');
    loDiv.innerHTML = loHtml;

    const nativeTables = nativeDiv.querySelectorAll('table');
    const loTables = loDiv.querySelectorAll('table');

    if (loTables.length === 0) return nativeHtml;

    // 깨진 네이티브 테이블을 LibreOffice 테이블로 교체
    // LibreOffice 테이블 텍스트 인덱스 (순서 매칭용)
    const loTableTexts = Array.from(loTables).map(t => t.textContent.replace(/\s+/g, ' ').trim());

    for (const nativeTable of Array.from(nativeTables)) {
      const rows = nativeTable.querySelectorAll('tr');
      let emptyCount = 0;
      for (const row of rows) {
        const hasContent = Array.from(row.querySelectorAll('td, th')).some(c => c.textContent.trim().length > 0);
        if (!hasContent) emptyCount++;
      }
      const isBroken = emptyCount >= 2 && emptyCount / rows.length > 0.3;

      if (!isBroken) continue;

      // 네이티브 테이블 전체 헤더행 텍스트로 매칭할 LibreOffice 테이블 찾기
      const firstRow = nativeTable.querySelector('tr');
      const nativeHeaderFull = firstRow ? firstRow.textContent.replace(/\s+/g, ' ').trim() : '';
      if (!nativeHeaderFull) continue;

      let bestLoIdx = -1;
      let bestScore = 0;
      for (let li = 0; li < loTables.length; li++) {
        const loFirstRow = loTables[li].querySelector('tr');
        if (!loFirstRow) continue;
        const loHeaderFull = loFirstRow.textContent.replace(/\s+/g, ' ').trim();
        // 헤더 단어 매칭 점수 (겹치는 단어 수)
        const nativeWords = new Set(nativeHeaderFull.split(/\s+/).filter(w => w.length > 1));
        let score = 0;
        for (const w of nativeWords) {
          if (loHeaderFull.includes(w)) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestLoIdx = li;
        }
      }
      if (bestLoIdx < 0 || bestScore < 2) continue;

      const loTable = loTables[bestLoIdx];

      // 1) LibreOffice 테이블 텍스트 (공백 정규화)
      const loTextNorm = loTable.textContent.replace(/\s+/g, ' ').trim();

      // 2) 문서 전체 <p> 중 LibreOffice 테이블 내용과 겹치는 것 제거
      const allPs = nativeDiv.querySelectorAll('p');
      const toRemove = [];
      for (const p of allPs) {
        const pText = p.textContent.trim();
        if (!pText || pText.length < 2) continue;
        const pNorm = pText.replace(/\s+/g, ' ');
        // LibreOffice 테이블에 포함된 텍스트면 제거 (15자 이상 매칭)
        const checkLen = Math.min(15, pNorm.length);
        if (loTextNorm.includes(pNorm.substring(0, checkLen))) {
          toRemove.push(p);
        }
      }
      for (const el of toRemove) el.remove();

      // 3) 테이블 교체
      nativeTable.replaceWith(loTable.cloneNode(true));
      console.log(`[HWP] 테이블 교체: 네이티브(${rows.length}행, 빈${emptyCount}) → LibreOffice(${loTable.rows.length}행), ${toRemove.length}개 <p> 제거`);
    }

    return nativeDiv.innerHTML;
  }

  // ============================================================
  // Vision 변환: HWP → PDF → 이미지 → Gemini Vision → 인크루트 HTML
  // ============================================================

  /** HWP/HWPX/DOCX 파일을 서버에서 원문 HTML로 변환 (AI 없이) */
  async function hwpToRawHtml(file) {
    const formData = new FormData();
    formData.append('file', file);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const resp = await fetch(`${CONVERT_SERVER_URL}/api/hwp-to-rawhtml`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `서버 오류 (${resp.status})`);
      }
      const data = await resp.json();
      if (!data.html) throw new Error('HTML 변환 결과가 비어있습니다.');
      return { html: data.html, warnings: data.warnings || [] };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('HTML 변환 시간 초과 (120초)');
      throw err;
    }
  }

  /** 원문 HTML 변환 핸들러 (AI 없이 LibreOffice HTML 추출 → 원문 영역 설정) */
  async function handleRawHtmlConvert(file) {
    if (state.loading) return;

    const progress = createProgressMessage();
    const step1 = progress.addStep(`LibreOffice HTML 변환 중 (${file.name})`, '📄');
    const step2 = progress.addStep('원문 영역 적용', '✍️');

    state.loading = true;
    try {
      const { html, warnings } = await hwpToRawHtml(file);
      progress.completeStep(step1, `HTML 추출 완료 (${html.length.toLocaleString()}자)`);

      // 원문 소스로 설정
      saveOriginalSource('file', html, { filename: file.name, format: file.name.split('.').pop(), conversion: 'libreoffice-rawhtml' });
      populateOriginalViewer();
      setViewAndActivateTab('original');
      progress.completeStep(step2, '원문 탭에 적용 완료');
      progress.finalize('원문 HTML 추출 완료');

      const warnNote = warnings.length ? `\n⚠ ${warnings.join(', ')}` : '';
      addMessage('assistant', `✅ "${file.name}" 원문 HTML 추출 완료!${warnNote}\n원문 탭에서 내용을 확인한 후 "채용공고 변환"을 눌러 인크루트 HTML로 변환하세요.`);

    } catch (err) {
      progress.finalize('원문 HTML 변환 실패');
      addMessage('assistant', `⚠ 원문 HTML 변환 실패: ${err.message}`);
    } finally {
      state.loading = false;
    }
  }

  /** HWP/HWPX 파일을 서버에서 PDF로 변환 후 base64 반환 */
  async function hwpToPdfBase64(file) {
    const formData = new FormData();
    formData.append('file', file);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const resp = await fetch(`${CONVERT_SERVER_URL}/api/hwp-to-pdf`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `서버 오류 (${resp.status})`);
      }
      const data = await resp.json();
      if (!data.pdf) throw new Error('PDF 변환 결과가 비어있습니다.');
      return data.pdf; // base64 string
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('PDF 변환 시간 초과 (120초)');
      throw err;
    }
  }

  /** PDF base64 → 각 페이지 이미지(base64 PNG) 배열 (PDF.js 사용) */
  async function pdfBase64ToImages(pdfBase64, maxPages = 10, scale = 2.0, startPage = 1) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js 라이브러리가 로드되지 않았습니다.');
    }
    const pdfData = atob(pdfBase64);
    const uint8 = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) uint8[i] = pdfData.charCodeAt(i);

    const pdf = await pdfjsLib.getDocument({
      data: uint8,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true
    }).promise;

    const endPage = Math.min(pdf.numPages, startPage - 1 + maxPages);
    const images = [];

    for (let i = startPage; i <= endPage; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      // PNG → base64 (data URL에서 헤더 제거)
      images.push(canvas.toDataURL('image/png').split(',')[1]);
    }

    return { images, totalPages: pdf.numPages, endPage };
  }

  /** Gemini Vision API 호출 (이미지 배열 + 시스템 프롬프트) */
  async function callGeminiVisionApi(pageImages, systemPrompt) {
    const apiKey = (state.provider === 'gemini' ? state.apiKey : '') || localStorage.getItem('ai_api_key_gemini') || '';
    if (!apiKey) throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');

    // 현재 선택된 Gemini 모델 사용 (Vision 지원 모델 우선)
    const selectedModel = (state.provider === 'gemini' ? state.model : '') || localStorage.getItem('ai_model_gemini') || 'gemini-2.5-pro';
    const model = selectedModel.startsWith('gemini-') ? selectedModel : 'gemini-2.5-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // 이미지를 먼저, 변환 지시를 마지막에 배치 (Gemini 권장 순서)
    const userParts = [
      ...pageImages.map(img => ({
        inline_data: { mime_type: 'image/png', data: img }
      })),
      {
        text: '위 채용공고 이미지를 인크루트 HTML 형식으로 변환해주세요.\n\n[절대 규칙] 이미지에 보이는 텍스트를 단 한 글자도 변경하지 말고 그대로 옮기세요. 이미지에 없는 내용은 절대 추가하지 마세요. 맞춤법 수정, 문장 재작성, 내용 추가/삭제 모두 금지입니다.'
      }
    ];

    const body = {
      // systemInstruction으로 분리해야 모델이 규칙을 더 엄격히 따름
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: userParts }],
      generationConfig: { temperature: 0, maxOutputTokens: 65536 }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const msg = errData?.error?.message || `Gemini API 오류 (${resp.status})`;
      throw new Error(msg);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('Gemini Vision 응답이 비어있습니다.');
    return text;
  }

  /** gemini-gem-prompt-v3.md 내용을 로드 (서버에서 fetch) */
  async function loadGeminiPromptV3() {
    try {
      const resp = await fetch('./docs/gemini-gem-prompt-v3.md?_=' + Date.now());
      if (resp.ok) return await resp.text();
    } catch (e) { /* 폴백으로 내장 프롬프트 사용 */ }
    // 폴백: 기본 인크루트 변환 지시
    return `당신은 'Incruit HTML Converter'입니다. 전달된 채용공고 이미지의 모든 텍스트를 누락 없이 인크루트 표준 HTML 구조로 변환하세요. 결과는 HTML 코드 블록만 출력하세요.`;
  }

  /** HWP Vision 변환 메인 핸들러 */
  /** File → base64 (브라우저에서 직접, 서버 불필요) */
  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleVisionConvert(file) {
    if (state.loading) return;
    const apiKey = (state.provider === 'gemini' ? state.apiKey : '') || localStorage.getItem('ai_api_key_gemini') || '';
    if (!apiKey) {
      addMessage('assistant', '⚠ Vision 변환은 Gemini API 키가 필요합니다. 설정(⚙)에서 Gemini API 키를 먼저 입력해주세요.');
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';

    const progress = createProgressMessage();
    const step1 = isPdf
      ? progress.addStep('PDF 파일 준비', '📄')
      : progress.addStep('PDF 변환 중 (LibreOffice)', '📄');
    const step2 = progress.addStep('페이지 이미지 렌더링', '🖼️');
    const step3 = progress.addStep('Gemini Vision 분석', '🤖');
    const step4 = progress.addStep('인크루트 HTML 생성', '✍️');

    state.loading = true;
    try {
      // Step 1: PDF 확보 (PDF는 브라우저에서 직접 읽기, 나머지는 서버 변환)
      let pdfBase64;
      if (isPdf) {
        pdfBase64 = await fileToBase64(file);
        progress.completeStep(step1, `PDF 파일 준비 완료 (${(file.size / 1024).toFixed(0)}KB)`);
      } else {
        pdfBase64 = await hwpToPdfBase64(file);
        progress.completeStep(step1, 'PDF 변환 완료');
      }

      // Step 2: PDF → 이미지 (최대 10페이지, scale=3.0으로 고해상도)
      const { images, totalPages, endPage } = await pdfBase64ToImages(pdfBase64, 10, 3.0);
      const pageNote = totalPages > endPage ? ` (전체 ${totalPages}p 중 ${endPage}p)` : ` (${totalPages}p)`;
      progress.completeStep(step2, `${images.length}페이지 이미지 추출${pageNote}`);

      // Step 3: Gemini Vision 분석
      const systemPrompt = await loadGeminiPromptV3();
      const visionModel = (state.provider === 'gemini' ? state.model : '') || localStorage.getItem('ai_model_gemini') || 'gemini-2.5-pro';
      const visionResponse = await callGeminiVisionApi(images, systemPrompt);
      progress.completeStep(step3, `Vision 분석 완료 (${visionModel})`);

      // Step 4: HTML 추출 및 미리보기 반영
      const html = extractHtmlFromResponse(visionResponse);
      if (!html || html.length < 50) {
        throw new Error('Gemini Vision 응답에서 HTML을 추출하지 못했습니다.');
      }
      progress.completeStep(step4, `HTML ${html.length.toLocaleString()}자 생성`);

      // 결과 반영
      state.convertedHtml = html;
      updatePreview(html);
      const kvCreated1 = tryApplyKvJson(visionResponse);
      tryAutoFillKvFromSource(state.originalSource?.html || '');
      setViewAndActivateTab('preview');
      saveSession();  // 리로드 후 복원 가능하도록 localStorage에 저장

      const continueNote = totalPages > endPage ? ` (전체 ${totalPages}p 중 ${endPage}p 분석)` : '';
      registerVisionContinue(pdfBase64, endPage, totalPages, null, pdfBase64ToImages, loadGeminiPromptV3);
      const copyBtns1 = buildCopyButtons(!!kvCreated1);
      const contBtn1 = totalPages > endPage ? buildContinueButton(endPage, totalPages) : '';
      progress.finalize(`Vision 변환 완료${continueNote}`);
      progress.addResult(`✓ <strong>Vision 변환 완료</strong> — 미리보기를 확인해주세요.${copyBtns1}${contBtn1}`);

    } catch (err) {
      progress.finalize('Vision 변환 실패');
      addMessage('assistant', `⚠ Vision 변환 실패: ${err.message}`);
    } finally {
      state.loading = false;
    }
  }

  /**
   * 볼드/밑줄/블릿 서식 매니페스트 생성.
   * formattingInfo(백엔드 run 레벨 데이터) 우선, 없으면 HTML 파싱 폴백.
   */
  function extractFormattingManifest(hwpHtml, formattingInfo) {
    let boldSet, underlineSet, bulletItems;

    if (formattingInfo && (formattingInfo.boldTexts?.length || formattingInfo.underlineTexts?.length || formattingInfo.bulletItems?.length)) {
      // 백엔드에서 python-docx run 레벨 데이터 직접 사용
      boldSet = new Set((formattingInfo.boldTexts || []).filter(t => t.length <= 80));
      underlineSet = new Set((formattingInfo.underlineTexts || []).filter(t => t.length <= 80));
      bulletItems = formattingInfo.bulletItems || [];
    } else if (hwpHtml) {
      // 폴백: HTML 태그 파싱
      boldSet = new Set();
      underlineSet = new Set();
      bulletItems = [];
      const parser = new DOMParser();
      const doc = parser.parseFromString(hwpHtml, 'text/html');
      doc.querySelectorAll('strong, b').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 0 && t.length <= 80) boldSet.add(t);
      });
      doc.querySelectorAll('u').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 0 && t.length <= 80) underlineSet.add(t);
      });
      doc.querySelectorAll('li[data-bullet]').forEach(el => {
        const bullet = el.getAttribute('data-bullet');
        const text = el.textContent.trim().slice(0, 80);
        if (bullet && text) bulletItems.push({ bullet, text });
      });
    } else {
      return '';
    }

    if (boldSet.size === 0 && underlineSet.size === 0 && bulletItems.length === 0) return '';

    const lines = ['\n\n## 📋 서식 매니페스트 (반드시 적용)'];
    lines.push('아래 목록의 각 항목은 원본 문서에서 직접 추출한 서식 정보입니다. 출력 HTML에서 반드시 반영해야 합니다.\n');

    if (boldSet.size > 0) {
      lines.push('[필수 볼드 목록] — 반드시 <strong>으로 감싸야 합니다:');
      boldSet.forEach(t => lines.push(`- "${t}"`));
    }

    if (underlineSet.size > 0) {
      lines.push('\n[필수 밑줄 목록] — 반드시 <u>로 감싸야 합니다:');
      underlineSet.forEach(t => lines.push(`- "${t}"`));
    }

    if (bulletItems.length > 0) {
      // 블릿 문자 → 인크루트 클래스 매핑
      const BULLET_CLASS = {
        '·': 'ulist', '•': 'ulist', '●': 'ulist bcir', '○': 'ulist cir',
        '-': 'ulist dash', '※': 'ulist noti', '✓': 'ulist check',
        '①': 'olist olcir', '1.': 'olist olnum', '가.': 'olist kolist',
        'a.': 'olist ollow', 'A.': 'olist olup', 'i.': 'olist olrom', 'I.': 'olist olRom'
      };
      // 사용된 고유 블릿 문자 목록
      const usedBullets = [...new Set(bulletItems.map(b => b.bullet))];
      lines.push('\n[블릿 목록] — 각 항목에 정확한 블릿 클래스를 적용해야 합니다:');
      lines.push('(블릿 문자 → 인크루트 클래스 매핑)');
      usedBullets.forEach(b => {
        const cls = BULLET_CLASS[b] || 'ulist';
        lines.push(`- "${b}" → <ul class="${cls}"><li>...</li></ul>`);
      });
      lines.push('\n[블릿 항목 목록]:');
      bulletItems.forEach(({ bullet, text }) => {
        const cls = BULLET_CLASS[bullet] || 'ulist';
        lines.push(`- [${cls}] "${text}"`);
      });
    }

    lines.push('\n위 목록에 없는 텍스트도 PDF 이미지에서 볼드/밑줄/블릿으로 보이면 추가로 적용하세요.');
    return lines.join('\n');
  }

  /** 이어서 변환 클로저를 state._visionContinueFunc에 등록 */
  function registerVisionContinue(pdfBase64, processedPages, totalPages, hwpHtml, pdfToImgFn, loadPromptFn) {
    if (totalPages <= processedPages) { state._visionContinueFunc = null; return; }
    state._visionContinueFunc = async function() {
      if (state.loading) return;
      const apiKey = localStorage.getItem('ai_api_key_gemini') || (state.provider === 'gemini' ? state.apiKey : '');
      if (!apiKey) { addMessage('assistant', '⚠ Vision 변환은 Gemini API 키가 필요합니다. 설정(⚙)에서 Gemini API 키를 먼저 입력해주세요.'); return; }
      state.loading = true;
      const curStart = processedPages + 1;
      const progress = createProgressMessage();
      const step1 = progress.addStep(`페이지 렌더링 (${curStart}p~)`, '🖼️');
      const step2 = progress.addStep('Gemini Vision 분석', '🤖');
      const step3 = progress.addStep('HTML 병합', '✍️');
      try {
        const { images, endPage } = await pdfToImgFn(pdfBase64, 10, 2.0, curStart);
        const pageRange = `${curStart}~${endPage}p`;
        progress.completeStep(step1, `${images.length}페이지 이미지 추출 (${pageRange})`);

        const systemPrompt = await loadPromptFn();
        const selectedModel = (state.provider === 'gemini' ? state.model : '') || localStorage.getItem('ai_model_gemini') || 'gemini-2.5-pro';
        const model = selectedModel.startsWith('gemini-') ? selectedModel : 'gemini-2.5-pro';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // 이전 변환 결과의 마지막 부분 + 섹션 번호를 컨텍스트로 제공
        const prevHtml = state.convertedHtml || '';
        const prevTail = prevHtml.length > 800 ? prevHtml.slice(-800) : prevHtml;

        // 이전 변환의 마지막 섹션 번호 추출
        const prevDoc = new DOMParser().parseFromString(`<div>${prevHtml}</div>`, 'text/html');
        const prevH2s = prevDoc.querySelectorAll('h2');
        const lastSectionNum = prevH2s.length;

        const prevContext = prevTail ? `\n\n[이전 변환 결과 마지막 부분 — 여기서 이어서 작성]\n${prevTail}\n\n위 HTML의 끝부분에서 이어지는 내용을 작성하세요. 위 내용을 중복하지 마세요.` : '';

        const refHtml = hwpHtml ? `\n\n[참고 원문 HTML (텍스트 기준)]\n${sanitizeForAI(hwpHtml)}` : '';

        const continuationInstruction = `위 이미지는 이전에 변환한 채용공고의 이어지는 페이지(${pageRange})입니다.
이미 변환된 앞 부분과 중복되지 않게, 이 페이지들에 해당하는 내용만 인크루트 표준 HTML로 변환해주세요.
결과는 HTML 코드 블록만 출력하고, <div id="templwrap_v3">는 포함하지 마세요. 섹션 HTML만 출력하세요.

🚨 중요:
- 아래 "이전 변환 결과 마지막 부분"에 이미 포함된 내용은 절대 다시 작성하지 마세요
- 이전 결과의 마지막 섹션이 도중에 끊겼다면 해당 섹션의 나머지부터 이어서 작성하세요
- 새로운 섹션이 시작되면 <h2>로 시작하세요
- 🚨 섹션 번호 이어서: 이전 변환에서 ${lastSectionNum}개 섹션까지 완료됨. 새 섹션 번호는 ${lastSectionNum + 1}부터 시작하세요 (예: ${String(lastSectionNum + 1).padStart(2, '0')}. 제목)
- 테이블이 끊겼다면 </table> 닫기 없이 이어서 행을 추가하세요${prevContext}${refHtml}`;

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [
              ...images.map(img => ({ inline_data: { mime_type: 'image/png', data: img } })),
              { text: continuationInstruction }
            ]}],
            generationConfig: { temperature: 0, maxOutputTokens: 65536 }
          })
        });
        if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e?.error?.message || `Gemini API 오류 (${resp.status})`); }
        const data = await resp.json();
        const visionResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!visionResponse) throw new Error('Gemini Vision 응답이 비어있습니다.');
        progress.completeStep(step2, `Vision 분석 완료 (${model})`);

        const newHtml = extractHtmlFromResponse(visionResponse);
        if (!newHtml || newHtml.length < 20) throw new Error('이어서 변환 응답에서 HTML을 추출하지 못했습니다.');

        // 기존 HTML에 templwrap_v3 래퍼가 있으면 .templ_content 안에 삽입
        // (바깥에 붙으면 updatePreview에서 .templ_content만 추출할 때 잘려나감)
        const prev = state.convertedHtml || '';
        if (/id=["']?templwrap_v3/i.test(prev)) {
          const tmp = document.createElement('div');
          tmp.innerHTML = prev;
          const tc = tmp.querySelector('#templwrap_v3 .templ_content') || tmp.querySelector('.templ_content');
          if (tc) {
            tc.innerHTML += '\n' + newHtml;
            state.convertedHtml = tmp.innerHTML;
          } else {
            state.convertedHtml = prev + '\n' + newHtml;
          }
        } else {
          state.convertedHtml = prev + '\n' + newHtml;
        }
        updatePreview();
        setViewAndActivateTab('preview');
        progress.completeStep(step3, `추가 HTML ${newHtml.length.toLocaleString()}자 병합`);

        processedPages = endPage;
        registerVisionContinue(pdfBase64, endPage, totalPages, hwpHtml, pdfToImgFn, loadPromptFn);
        const hasMore = endPage < totalPages;
        const copyBtns = buildCopyButtons(false);
        const contBtn = hasMore ? buildContinueButton(endPage, totalPages) : '';
        progress.finalize(`이어서 변환 완료 (${pageRange})`);
        progress.addResult(`✓ <strong>이어서 변환 완료</strong> (${pageRange}) — 미리보기를 확인해주세요.${copyBtns}${contBtn}`);
      } catch (err) {
        progress.finalize('이어서 변환 실패');
        addMessage('assistant', `⚠ 이어서 변환 실패: ${err.message}`);
      } finally {
        state.loading = false;
      }
    };
  }

  // ============================================================
  // Vision API 공용 호출 헬퍼 (Gemini/Claude 자동 분기)
  // 검증·수정 2차 패스에서 재사용
  // ============================================================
  async function callVisionApiGeneric({ images, systemPrompt, userText, useGemini, geminiKey, claudeKey, maxTokens = 16000 }) {
    if (useGemini) {
      const selectedModel = (state.provider === 'gemini' ? state.model : '') || localStorage.getItem('ai_model_gemini') || 'gemini-2.5-pro';
      const model = selectedModel.startsWith('gemini-') ? selectedModel : 'gemini-2.5-pro';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const userParts = [
        ...images.map(img => ({ inline_data: { mime_type: 'image/png', data: img } })),
        { text: userText }
      ];
      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536 }
      };
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API 오류 (${resp.status})`);
      }
      const data = await resp.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      const claudeModel = localStorage.getItem('ai_model_claude') || 'claude-sonnet-4-6';
      const targetUrl = 'https://api.anthropic.com/v1/messages';
      let apiUrl;
      try {
        const h = await fetch('http://localhost:8787/health', { signal: AbortSignal.timeout(2000) });
        apiUrl = h.ok ? `http://localhost:8787/proxy/?url=${encodeURIComponent(targetUrl)}` : targetUrl;
      } catch { apiUrl = targetUrl; }
      const content = [
        ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: img } })),
        { type: 'text', text: userText }
      ];
      const isProxy = apiUrl.startsWith('http://localhost:8787');
      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': claudeKey,
        ...(isProxy ? {} : { 'anthropic-dangerous-direct-browser-access': 'true' })
      };
      const claudeResp = await fetch(apiUrl, {
        method: 'POST', headers,
        body: JSON.stringify({ model: claudeModel, max_tokens: maxTokens, temperature: 0, system: systemPrompt, messages: [{ role: 'user', content }] })
      });
      if (!claudeResp.ok) {
        const err = await claudeResp.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Claude API 오류 (${claudeResp.status})`);
      }
      const claudeData = await claudeResp.json();
      return claudeData?.content?.[0]?.text || '';
    }
  }

  // ============================================================
  // 앵커 기반 타겟 수정 유틸리티
  // ============================================================

  /** HTML의 주요 블록에 data-verify-id="blk-N" 마커 부여 */
  function addVerifyMarkers(html) {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstChild;
    const selectors = '.sec_wrap, .table_x, table, ul, ol, h1, h2, h3, blockquote';
    const elements = root.querySelectorAll(selectors);
    let counter = 0;
    const seen = new WeakSet();
    for (const el of elements) {
      if (seen.has(el)) continue;
      // 중첩 요소는 가장 바깥 요소만 마커 부여 (table_x > table 같은 경우 table_x만)
      let parentHasMarker = false;
      let parent = el.parentElement;
      while (parent && parent !== root) {
        if (parent.hasAttribute('data-verify-id')) { parentHasMarker = true; break; }
        parent = parent.parentElement;
      }
      if (parentHasMarker) continue;
      const id = `blk-${++counter}`;
      el.setAttribute('data-verify-id', id);
      seen.add(el);
    }
    return { html: root.innerHTML, count: counter };
  }

  /** 검증 응답에서 [blk-N] 또는 blk-N 패턴 추출하여 블록별 이슈 맵 생성 */
  function parseBlockIssues(issuesText) {
    const blockIssues = {};
    const globalIssues = [];
    const lines = issuesText.split(/\r?\n/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      const match = trimmedLine.match(/\[?blk-(\d+)\]?\s*[:\-]?\s*(.*)/i);
      if (match && match[2]) {
        const id = `blk-${match[1]}`;
        if (!blockIssues[id]) blockIssues[id] = [];
        blockIssues[id].push(match[2].trim());
      } else if (trimmedLine.length > 3 && !trimmedLine.startsWith('문제 없음')) {
        globalIssues.push(trimmedLine);
      }
    }
    return { blockIssues, globalIssues };
  }

  /** 마킹된 HTML에서 특정 블록 outerHTML 추출 */
  function getBlockHtml(fullHtml, blockId) {
    const doc = new DOMParser().parseFromString(`<div>${fullHtml}</div>`, 'text/html');
    const root = doc.body.firstChild;
    const el = root.querySelector(`[data-verify-id="${blockId}"]`);
    return el ? el.outerHTML : null;
  }

  /** 마킹된 HTML에서 특정 블록을 새 HTML로 교체 */
  function replaceBlockInHtml(fullHtml, blockId, newBlockHtml) {
    const doc = new DOMParser().parseFromString(`<div>${fullHtml}</div>`, 'text/html');
    const root = doc.body.firstChild;
    const target = root.querySelector(`[data-verify-id="${blockId}"]`);
    if (!target) return fullHtml;
    const temp = doc.createElement('div');
    temp.innerHTML = newBlockHtml;
    const newNode = temp.firstElementChild;
    if (!newNode) return fullHtml;
    // 새 블록에 data-verify-id가 없으면 원래 ID 복원
    if (!newNode.hasAttribute('data-verify-id')) {
      newNode.setAttribute('data-verify-id', blockId);
    }
    target.replaceWith(newNode);
    return root.innerHTML;
  }

  /** HTML에서 모든 data-verify-id 속성 제거 */
  function removeVerifyMarkers(html) {
    return html.replace(/\s*data-verify-id="blk-\d+"/g, '');
  }

  // ============================================================
  // 검증 & 수정 수동 트리거 (앵커 기반 타겟 수정)
  // ============================================================
  async function handleVisionVerifyAndFix() {
    if (state.loading) return;
    const ctx = state.visionVerifyContext;
    if (!ctx || !ctx.images || !ctx.images.length) {
      addMessage('assistant', '⚠ 검증할 변환 결과 컨텍스트가 없습니다. 다시 변환해주세요.');
      return;
    }
    const currentHtml = state.convertedHtml;
    if (!currentHtml || currentHtml.length < 50) {
      addMessage('assistant', '⚠ 변환된 HTML이 없습니다.');
      return;
    }

    state.loading = true;
    const progress = createProgressMessage();
    const stepV = progress.addStep('환각·누락 검증 (앵커 기반)', '🔍');
    const stepF = progress.addStep('타겟 수정 (필요한 블록만)', '🛠');

    try {
      // 1. HTML에 블록 마커 부여
      const { html: markedHtml, count: blockCount } = addVerifyMarkers(currentHtml);

      // 2. 검증 프롬프트 (블록 ID 참조 요청)
      const verifySystem = `당신은 HTML 변환 결과를 검증하는 전문가입니다. 첨부된 원본 이미지와 아래 HTML을 비교하여 이슈를 찾아냅니다.

HTML의 각 블록에는 data-verify-id="blk-N" 속성이 부여되어 있습니다. 이슈를 보고할 때는 반드시 해당 블록 ID를 참조하세요.

점검 항목:
1. 환각 (이미지에 없는 내용이 HTML에 추가됨) — 텍스트·박스·테두리·색상·볼드·밑줄·이미지·표·행·열 포함
2. 누락 (이미지에 있는데 HTML에 빠짐)
3. 중복 (이미지에 1회 있는데 HTML에 2회 이상)
4. 구조 오류 (중첩 표/박스 평탄화, 위치 이동, 셀 밖 탈출)
5. 순서 오류 (원본과 다른 순서)
6. 서식 오류 (불필요한 볼드/빨강 추가, 원본 서식 누락)
7. 숫자·날짜·이름·URL·연락처 불일치

응답 형식 (반드시 준수):
- 이슈 없으면: 첫 줄에 "문제 없음"만 출력
- 이슈 있으면: 각 이슈를 한 줄씩, 반드시 [blk-N] 프리픽스로 시작
  예시:
    [blk-3] ※ 주의사항이 <tr>로 흡수됨 → 표 닫고 <ul class="ulist noti">로 이동
    [blk-5] 원본에 없는 파란색 박스 추가 → 제거
    [blk-7] 표 마지막 행 누락 (합계 행)

이슈가 어느 블록에 속하는지 반드시 data-verify-id 값을 확인하여 정확한 blk-N을 명시하세요.
설명·분석 없이 이슈 목록만 출력하세요.`;

      const verifyUser = `[검증 대상 HTML (${blockCount}개 블록에 data-verify-id 부여됨)]\n\`\`\`html\n${markedHtml}\n\`\`\``;
      const issues = await callVisionApiGeneric({
        images: ctx.images, systemPrompt: verifySystem, userText: verifyUser,
        useGemini: ctx.useGemini, geminiKey: ctx.geminiKey, claudeKey: ctx.claudeKey
      });

      const trimmed = (issues || '').trim();
      const hasIssues = trimmed.length > 10 && !trimmed.startsWith('문제 없음');

      if (!hasIssues) {
        progress.completeStep(stepV, '문제 없음');
        progress.completeStep(stepF, '건너뜀');
        progress.finalize('검증 완료 — 수정 불필요');
        progress.addResult(`✓ <strong>검증 완료</strong> — 문제 없음`);
        return;
      }

      // 3. 이슈 파싱 — 블록별 그룹핑
      const { blockIssues, globalIssues } = parseBlockIssues(trimmed);
      const flaggedBlocks = Object.keys(blockIssues);
      const issuesSummaryPreview = trimmed.substring(0, 600).replace(/</g, '&lt;');
      progress.completeStep(stepV, `${flaggedBlocks.length}개 블록에 이슈 발견${globalIssues.length ? ` (+전역 ${globalIssues.length})` : ''}`);

      if (flaggedBlocks.length === 0) {
        // 블록 ID 없이 전역 이슈만 반환된 경우 → 전체 HTML fix로 폴백
        const fixUser = `${ctx.userPartsText}\n\n[직전 변환 HTML]\n\`\`\`html\n${currentHtml}\n\`\`\`\n\n[검증 이슈]\n${trimmed}\n\n위 이슈를 수정한 HTML을 출력하세요. 이슈와 무관한 부분은 그대로 유지.`;
        const fixedResponse = await callVisionApiGeneric({
          images: ctx.images, systemPrompt: ctx.systemPrompt, userText: fixUser,
          useGemini: ctx.useGemini, geminiKey: ctx.geminiKey, claudeKey: ctx.claudeKey
        });
        const fixedHtml = extractHtmlFromResponse(fixedResponse);
        if (fixedHtml && fixedHtml.length > 100) {
          state.convertedHtml = fixedHtml;
          updatePreview(fixedHtml);
          saveSession();
          progress.completeStep(stepF, `전체 수정 완료 (폴백)`);
        } else {
          progress.completeStep(stepF, '수정 실패 — 원본 유지');
        }
        progress.finalize('검증·수정 완료 (폴백)');
        progress.addResult(`⚠ 블록 ID 없이 전역 이슈만 반환되어 전체 수정으로 폴백<details><summary>이슈 보기</summary><pre style="white-space:pre-wrap;font-size:12px;">${issuesSummaryPreview}</pre></details>`);
        return;
      }

      // 4. 블록별 개별 수정
      let patchedHtml = markedHtml;
      let successCount = 0;
      let failCount = 0;
      const fixDetails = [];

      for (const blockId of flaggedBlocks) {
        const blockIssueList = blockIssues[blockId];
        const blockHtml = getBlockHtml(patchedHtml, blockId);
        if (!blockHtml) {
          failCount++;
          fixDetails.push(`${blockId}: 블록을 찾을 수 없음`);
          continue;
        }

        const blockFixUser = `원본 이미지를 참고하여 **아래 HTML 블록 하나만** 수정하세요.

[블록 ID]: ${blockId}
[발견된 이슈]:
${blockIssueList.map((i, n) => `${n + 1}. ${i}`).join('\n')}

[수정 전 블록 HTML]
\`\`\`html
${blockHtml}
\`\`\`

규칙:
- **반드시 블록 하나만** 반환. 외부 요소(다른 blk-N) 포함 금지.
- data-verify-id="${blockId}" 속성은 반드시 유지
- 이슈와 관련 없는 부분은 그대로 유지 (텍스트 변경 최소화)
- 이미지에 없는 내용 추가 금지, 있는 내용 삭제 금지
- HTML 블록만 코드 블록으로 출력 (설명 없이)`;

        try {
          const blockFixResponse = await callVisionApiGeneric({
            images: ctx.images, systemPrompt: ctx.systemPrompt, userText: blockFixUser,
            useGemini: ctx.useGemini, geminiKey: ctx.geminiKey, claudeKey: ctx.claudeKey,
            maxTokens: 8000
          });
          const fixedBlockHtml = extractHtmlFromResponse(blockFixResponse);
          if (fixedBlockHtml && fixedBlockHtml.length > 20) {
            patchedHtml = replaceBlockInHtml(patchedHtml, blockId, fixedBlockHtml);
            successCount++;
            fixDetails.push(`✓ ${blockId}: ${blockIssueList.length}개 이슈 수정`);
          } else {
            failCount++;
            fixDetails.push(`✗ ${blockId}: Vision 응답 추출 실패`);
          }
        } catch (err) {
          failCount++;
          fixDetails.push(`✗ ${blockId}: ${err.message}`);
        }
      }

      // 5. 마커 제거 + state 반영
      const finalHtml = removeVerifyMarkers(patchedHtml);
      state.convertedHtml = finalHtml;
      updatePreview(finalHtml);
      saveSession();

      progress.completeStep(stepF, `${successCount}개 수정 완료${failCount ? ` / ${failCount}개 실패` : ''}`);
      progress.finalize('검증·수정 완료');

      const detailsHtml = fixDetails.map(d => `<div>${d.replace(/</g, '&lt;')}</div>`).join('');
      const copyBtnsFix = buildCopyButtons(false);
      progress.addResult(`✓ <strong>검증·수정 완료</strong> — ${successCount}개 블록 수정됨.<details><summary>상세 보기</summary><div style="font-size:12px;margin-top:6px;">${detailsHtml}</div><details style="margin-top:6px;"><summary>원본 이슈 목록</summary><pre style="white-space:pre-wrap;font-size:12px;">${issuesSummaryPreview}</pre></details></details>${copyBtnsFix}`);
    } catch (err) {
      progress.finalize('검증·수정 실패');
      addMessage('assistant', `⚠ 검증·수정 실패: ${err.message}`);
    } finally {
      state.loading = false;
    }
  }
  window.__handleVisionVerifyAndFix = handleVisionVerifyAndFix;

  // ============================================================
  // HWP+PDF 조합 Vision 변환
  // HWP → 텍스트/구조 추출 (정확한 원문)
  // PDF → 이미지 렌더링 (색상·정렬 시각 참조)
  // Gemini Vision → 두 정보 합쳐서 인크루트 HTML 생성
  // ============================================================
  async function handleHwpPdfCombinedVision(hwpFile, pdfFile) {
    if (state.loading) return;
    const geminiKey = localStorage.getItem('ai_api_key_gemini') || (state.provider === 'gemini' ? state.apiKey : '');
    const claudeKey = localStorage.getItem('ai_api_key_claude') || localStorage.getItem('ai_api_key') || (state.provider === 'claude' ? state.apiKey : '');
    const useGemini = !!geminiKey;
    const useClaude = !geminiKey && !!claudeKey;
    if (!useGemini && !useClaude) {
      addMessage('assistant', '⚠ Vision 변환은 Gemini 또는 Claude API 키가 필요합니다. 설정(⚙)에서 API 키를 입력해주세요.');
      return;
    }

    const progress = createProgressMessage();
    const step1 = progress.addStep(`HWP 텍스트 구조 추출 (${hwpFile.name})`, '📄');
    const step2 = progress.addStep(`PDF 이미지 렌더링 (${pdfFile.name})`, '🖼️');
    const step3 = progress.addStep('Vision 분석 (구조 + 서식 통합)', '🤖');
    const step4 = progress.addStep('인크루트 HTML 생성', '✍️');

    state.loading = true;
    try {
      // Step 1: HWP → HTML + 서식 정보 (항상 백엔드에서 직접 추출)
      let hwpHtml = '';
      let hwpFormattingInfo = null;
      if (state.convertServerAvailable) {
        try {
          const isV2 = localStorage.getItem('pipeline_version') === 'v2';
          const backendResult = await extractViaBackend(hwpFile, isV2 ? { parser: 'native' } : {});
          if (backendResult.html && backendResult.html.length > 50) {
            hwpHtml = backendResult.html;
            const meta = backendResult.metadata || {};
            if (meta.bold_texts !== undefined || meta.underline_texts !== undefined || meta.bullet_items !== undefined) {
              hwpFormattingInfo = {
                boldTexts: meta.bold_texts || [],
                underlineTexts: meta.underline_texts || [],
                bulletItems: meta.bullet_items || [],
                _convPath: meta.conversion_path || (meta.warnings?.[0] || '')
              };
            }

            // v2 하이브리드: 네이티브 결과에 깨진 테이블이 있으면 LibreOffice HTML 전체 사용
            if (isV2 && _hasBrokenTables(hwpHtml)) {
              console.log('[HWP] v2 하이브리드: 깨진 테이블 감지 → LibreOffice HTML로 전환');
              try {
                const loResult = await extractViaBackend(hwpFile); // LibreOffice (parser 없이)
                if (loResult.html && loResult.html.length > 50) {
                  hwpHtml = loResult.html;
                  // LibreOffice 결과의 서식 정보로 교체
                  const loMeta = loResult.metadata || {};
                  if (loMeta.bold_texts !== undefined) {
                    hwpFormattingInfo = {
                      boldTexts: loMeta.bold_texts || [],
                      underlineTexts: loMeta.underline_texts || [],
                      bulletItems: loMeta.bullet_items || [],
                      _convPath: loMeta.conversion_path || 'LibreOffice (하이브리드 폴백)'
                    };
                  }
                  console.log('[HWP] v2 하이브리드: LibreOffice HTML 사용 (' + loResult.html.length + '자)');
                }
              } catch (e) { console.warn('[HWP] LibreOffice 폴백 실패:', e.message); }
            }
          }
        } catch (e) { console.error('[HWP] 백엔드 추출 오류:', e); /* 폴백 */ }
      }
      if (!hwpHtml) {
        const browserResult = await extractFromFile(hwpFile);
        hwpHtml = browserResult.html || '';
      }
      if (!hwpHtml || hwpHtml.length < 30) {
        throw new Error('HWP 파일에서 텍스트를 추출하지 못했습니다.');
      }
      // 원문 탭에 HWP 내용 저장
      saveOriginalSource('file', hwpHtml, { filename: hwpFile.name, format: 'hwp', combination: 'hwp+pdf' });
      populateOriginalViewer();

      // 비교 뷰용 PDF 텍스트 추출 (baseline 보강; 실패해도 변환은 계속)
      // build 413: HWP+PDF 비교 뷰에서 "추가" 오탐 제거 — PDF 원문도 baseline에 포함
      (async () => {
        try {
          const { extractFromFile } = await import('./services/fileExtractor.js');
          const pdfResult = await extractFromFile(pdfFile);
          if (state.originalSource && pdfResult?.html) {
            state.originalSource.pdfHtml = pdfResult.html;
            state.originalSource.pdfText = pdfResult.text || '';
            try { localStorage.setItem(wsKey('original_source'), JSON.stringify(state.originalSource)); } catch {}
            console.log('[compare] PDF 텍스트 baseline 추가 — ' + pdfResult.html.length + '자');
          }
        } catch (pdfErr) { console.warn('[compare] PDF 텍스트 추출 실패:', pdfErr.message); }
      })();
      const _fi = hwpFormattingInfo;
      const _fiSummary = _fi
        ? `볼드 ${_fi.boldTexts.length}개 / 밑줄 ${_fi.underlineTexts.length}개 / 블릿 ${_fi.bulletItems.length}개${_fi._convPath ? ` [${_fi._convPath}]` : ''}`
        : '서식 정보 없음 (HTML 태그 파싱 폴백)';
      const _fiDetailId = 'fi-detail-' + Date.now();
      const _fiDetailHtml = _fi ? [
        `<div id="${_fiDetailId}" style="display:none;margin-top:6px;font-size:11px;background:var(--bg-secondary);border-radius:4px;padding:8px;max-height:200px;overflow-y:auto;white-space:pre-wrap;">`,
        _fi.boldTexts.length ? `[볼드]\n${_fi.boldTexts.map(t => `  "${t}"`).join('\n')}` : '',
        _fi.underlineTexts.length ? `\n[밑줄]\n${_fi.underlineTexts.map(t => `  "${t}"`).join('\n')}` : '',
        _fi.bulletItems.length ? `\n[블릿]\n${_fi.bulletItems.map(b => `  [${b.bullet}] "${b.text}"`).join('\n')}` : '',
        `</div>`
      ].join('') : '';
      const _fiBtn = _fi ? `<button onclick="var el=document.getElementById('${_fiDetailId}');if(el)el.style.display=el.style.display==='none'?'block':'none';" style="font-size:11px;padding:1px 6px;margin-left:4px;cursor:pointer;border-radius:3px;">확인▾</button>${_fiDetailHtml}` : '';
      progress.completeStep(step1, `HWP 구조 추출 완료 (${hwpHtml.length.toLocaleString()}자) — 서식: ${_fiSummary}${_fiBtn}`);

      // Step 2: PDF → 이미지 (브라우저 PDF.js 직접)
      const pdfBase64 = await fileToBase64(pdfFile);
      const { images, totalPages, endPage } = await pdfBase64ToImages(pdfBase64, 10, 3.0);
      const pageNote = totalPages > endPage ? ` (전체 ${totalPages}p 중 ${endPage}p)` : ` (${totalPages}p)`;
      progress.completeStep(step2, `PDF ${images.length}페이지 이미지 추출${pageNote}`);

      // Step 3: Vision API 호출 (Gemini 우선, Claude 폴백)
      const systemPrompt = await loadGeminiPromptV3();
      const hwpTextForPrompt = sanitizeForAI(hwpHtml);
      const formattingManifest = extractFormattingManifest(hwpHtml, hwpFormattingInfo);

      const userPartsText = `위 이미지는 원본 문서의 PDF 렌더링입니다 (색상·볼드·밑줄·정렬·블릿 스타일 참조용).
아래 HTML은 동일 문서의 HWP에서 추출한 텍스트 구조입니다 (텍스트 내용의 절대 기준).

## 🚨 텍스트 보존 절대 규칙 (최우선)
1. 텍스트 내용 → HWP HTML 기준 (이미지보다 무조건 우선)
2. 텍스트 순서·테이블 위치 → HWP HTML의 순서 그대로 유지 (재배치·이동 절대 금지)
3. 텍스트 삭제 → 절대 금지. HWP에 있는 모든 텍스트는 빠짐없이 포함
4. 텍스트 추가 → 절대 금지. HWP에 없는 텍스트는 절대 생성하지 말 것 (환각 금지)
5. 텍스트 수정 → 명백한 오탈자·띄어쓰기만 최소한으로 수정 가능. 의미·단어 변경 금지

## 🎨 스타일 적용 절대 규칙 (반드시 이행)
HWP HTML에 포함된 <strong>, <b>, <u> 태그는 원본 문서의 볼드/밑줄 정보입니다. 이 태그들은 반드시 출력 HTML에 그대로 보존해야 합니다.
PDF 이미지는 HWP HTML에서 누락된 스타일(색상, 밑줄, 볼드)을 추가로 보완하는 용도입니다.

[스타일 보존 규칙]
1. HWP HTML에 <strong>텍스트</strong> 또는 <b>텍스트</b>가 있으면 → 출력에도 반드시 <strong>텍스트</strong> 유지
2. HWP HTML에 <u>텍스트</u>가 있으면 → 출력에도 반드시 <u>텍스트</u> 유지
3. PDF 이미지에서 볼드로 보이지만 HWP HTML에 <strong>/<b>가 없는 경우 → <strong>텍스트</strong> 추가
4. PDF 이미지에서 밑줄로 보이지만 HWP HTML에 <u>가 없는 경우 → <u>텍스트</u> 추가
5. PDF 이미지에서 빨간색 텍스트 → <span class="rt">텍스트</span> (style="color:..." 절대 금지)
6. PDF 이미지에서 파란색 텍스트 → <span class="bt">텍스트</span>
⚠️ 색상 판단 엄격 기준:
- 빨간색(#FF0000, #CC0000 계열, 붉은 계통)일 때만 rt 사용
- 파란색(#0000FF, #0066CC 계열, 푸른 계통)일 때만 bt 사용
- 파란색을 rt로 처리하는 것은 절대 금지 — 파란색은 반드시 bt
- 검정·진한 회색·갈색 볼드 텍스트는 절대 rt/bt로 처리하지 않음
- 볼드(굵기)와 색상(빨강/파랑)은 완전히 별개 — 볼드라고 rt/bt를 추가하지 말 것

[중첩 조합]
- 빨강 + 볼드 + 밑줄 → <span class="rt"><strong><u>텍스트</u></strong></span>
- 빨강 + 볼드 → <span class="rt"><strong>텍스트</strong></span>
- 빨강 + 밑줄 → <span class="rt"><u>텍스트</u></span>
- 볼드 + 밑줄 (색상 없음) → <strong><u>텍스트</u></strong> ← rt/bt 절대 사용 금지
- 볼드만 (색상 없음) → <strong>텍스트</strong> ← rt/bt 절대 사용 금지

[한국어 문서 패턴]
- "** "로 시작하는 줄: "** "를 제거하고 전체 문장에 <strong><u>...</u></strong> 적용. 빨간색이면 <span class="rt"><strong><u>...</u></strong></span>
- "단어 :" 형태(예: "연 령 :", "근 로 :")로 볼드 표시된 경우: <strong>단어</strong> : 형태로 출력

[테이블 및 불릿]
- 테이블 위치: 원본 문서에서의 위치 그대로 유지. 앞뒤 텍스트와의 상대적 위치 절대 변경 금지
- 불릿 종류: HWP HTML의 실제 유니코드 문자 기준 (이미지 시각 추정 금지)
  - HWP HTML에 "·" → ulist, "- " → ulist dash, "※" → ulist noti, "○" → ulist cir, "●" → ulist bcir
  - HWP HTML에 "①②" → olist olcir, "1. 2." → olist olnum, "가. 나." → olist kolist 등

## 우선순위 정리
| 항목 | 기준 |
|------|------|
| 텍스트 내용 | HWP HTML (절대) |
| 텍스트 순서·테이블 위치 | HWP HTML (절대) |
| 볼드·밑줄 | HWP HTML 우선, PDF 이미지로 보완 |
| 색상 | PDF 이미지 |
| 테이블 셀 정렬 | PDF 이미지 |
| 블릿 유니코드 문자 | HWP HTML |
| 표 구조·셀 병합 | HWP HTML |

[HWP 원문 HTML]
${hwpTextForPrompt}
${formattingManifest}

위 두 소스를 통합하여 인크루트 표준 HTML로 변환해주세요. HWP의 모든 텍스트를 순서대로 빠짐없이 포함하고, 스타일 매니페스트의 볼드/밑줄을 반드시 적용하고, PDF 이미지에서 색상·정렬을 추가 반영하세요.`;

      let visionResponse = '';

      if (useGemini) {
        // Gemini Vision 호출 (HWP HTML을 텍스트 파트로, PDF 이미지를 비전 파트로)
        const selectedModel = (state.provider === 'gemini' ? state.model : '') || localStorage.getItem('ai_model_gemini') || 'gemini-2.5-pro';
        const model = selectedModel.startsWith('gemini-') ? selectedModel : 'gemini-2.5-pro';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

        const userParts = [
          // PDF 이미지를 먼저 (시각 참조)
          ...images.map(img => ({ inline_data: { mime_type: 'image/png', data: img } })),
          // HWP 구조 HTML을 텍스트로
          { text: userPartsText }
        ];

        const body = {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: userParts }],
          generationConfig: { temperature: 0, maxOutputTokens: 65536 }
        };

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Gemini API 오류 (${resp.status})`);
        }

        const data = await resp.json();
        visionResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!visionResponse) throw new Error('Gemini Vision 응답이 비어있습니다.');
        progress.completeStep(step3, `Vision 분석 완료 (${model})`);

      } else {
        // Claude Vision 호출 (CORS 프록시 경유)
        const claudeModel = localStorage.getItem('ai_model_claude') || 'claude-sonnet-4-6';
        const targetUrl = 'https://api.anthropic.com/v1/messages';
        let apiUrl;
        try {
          const h = await fetch('http://localhost:8787/health', { signal: AbortSignal.timeout(2000) });
          apiUrl = h.ok ? `http://localhost:8787/proxy/?url=${encodeURIComponent(targetUrl)}` : targetUrl;
        } catch { apiUrl = targetUrl; }

        const content = [
          ...images.map(img => ({
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: img }
          })),
          { type: 'text', text: `위 이미지는 원본 문서의 PDF 렌더링입니다.\n아래 HTML은 동일 문서의 HWP에서 추출한 텍스트 구조입니다.\n\n${userPartsText}` }
        ];

        const isProxy = apiUrl.startsWith('http://localhost:8787');
        const headers = {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': claudeKey,
          ...(isProxy ? {} : { 'anthropic-dangerous-direct-browser-access': 'true' })
        };

        const claudeResp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: claudeModel,
            max_tokens: 16000,
            temperature: 0,
            system: systemPrompt,
            messages: [{ role: 'user', content }]
          })
        });

        if (!claudeResp.ok) {
          const err = await claudeResp.json().catch(() => ({}));
          throw new Error(err?.error?.message || `Claude API 오류 (${claudeResp.status})`);
        }
        const claudeData = await claudeResp.json();
        visionResponse = claudeData?.content?.[0]?.text || '';
        if (!visionResponse) throw new Error('Claude Vision 응답이 비어있습니다.');
        progress.completeStep(step3, `Vision 분석 완료 (${claudeModel})`);
      }

      // Step 4: HTML 추출 및 미리보기 반영
      const html = extractHtmlFromResponse(visionResponse);
      if (!html || html.length < 50) {
        throw new Error('Gemini Vision 응답에서 HTML을 추출하지 못했습니다.');
      }
      progress.completeStep(step4, `HTML ${html.length.toLocaleString()}자 생성`);

      state.convertedHtml = html;
      updatePreview(html);
      const kvCreated2 = tryApplyKvJson(visionResponse);
      tryAutoFillKvFromSource(hwpHtml);
      setViewAndActivateTab('preview');
      saveSession();  // 리로드 후 복원 가능하도록 저장

      // ── 원문 보존 검증 ──
      const sVerify2 = progress.addStep('원문 보존 검증', '🔍');
      const verification2 = verifyConversion(hwpHtml, state.convertedHtml);
      const gradeInfo2 = `${verification2.grade} 등급 (${verification2.score}/100점, 일치율 ${verification2.textMatch}%)`;
      progress.completeStep(sVerify2, gradeInfo2);

      // 검증 결과를 마지막 메시지에 저장 (Step 14.6 게이트용)
      const lastMsgForVerify2 = state.messages[state.messages.length - 1];
      if (lastMsgForVerify2) lastMsgForVerify2.verifyResult = verification2;

      if (verification2.score < 80) {
        progress.addResult(`⚠ <strong>검증 주의</strong> — 텍스트 일치율 ${verification2.textMatch}%. 누락 항목: ${verification2.missingTexts.slice(0, 3).map(t => `"${t.substring(0, 20)}"`).join(', ')}${verification2.missingTexts.length > 3 ? ` 외 ${verification2.missingTexts.length - 3}건` : ''}`);
      }

      const continueNote = totalPages > endPage ? ` (전체 ${totalPages}p 중 ${endPage}p 분석)` : '';
      if (useGemini) registerVisionContinue(pdfBase64, endPage, totalPages, hwpHtml, pdfBase64ToImages, loadGeminiPromptV3);

      // 검증·수정 수동 트리거용 컨텍스트 저장
      state.visionVerifyContext = {
        images, systemPrompt, useGemini, geminiKey, claudeKey,
        userPartsText
      };

      const copyBtns2 = buildCopyButtons(!!kvCreated2);
      const contBtn2 = useGemini && totalPages > endPage ? buildContinueButton(endPage, totalPages) : '';
      const verifyBtn2 = `<button onclick="window.__handleVisionVerifyAndFix && window.__handleVisionVerifyAndFix()" style="margin-left:6px;padding:4px 10px;font-size:12px;background:#f0f4ff;border:1px solid #6b8afd;border-radius:4px;cursor:pointer;">🔍 검증 &amp; 수정</button>`;
      progress.finalize(`HWP+PDF Vision 변환 완료${continueNote}`);
      progress.addResult(`✓ <strong>HWP+PDF Vision 변환 완료</strong> — 미리보기를 확인해주세요.${copyBtns2}${verifyBtn2}${contBtn2}`);

    } catch (err) {
      progress.finalize('HWP+PDF Vision 변환 실패');
      addMessage('assistant', `⚠ HWP+PDF Vision 변환 실패: ${err.message}`);
    } finally {
      state.loading = false;
    }
  }

  // ============================================================
  // DOCX + PDF 조합 변환
  // Word 문서 텍스트(100% 기준) + PDF 이미지(색상·볼드·밑줄·정렬·블릿 class 참조)
  // → Gemini Vision으로 통합 변환
  // ============================================================
  async function handleDocxPdfCombined(docxFile, pdfFile) {
    if (state.loading) return;
    const apiKey = (state.provider === 'gemini' ? state.apiKey : '') || localStorage.getItem('ai_api_key_gemini') || '';
    if (!apiKey) {
      addMessage('assistant', '⚠ Vision 변환은 Gemini API 키가 필요합니다. 설정(⚙)에서 Gemini API 키를 먼저 입력해주세요.');
      return;
    }

    const progress = createProgressMessage();
    const step1 = progress.addStep(`Word 문서 텍스트 추출 (${docxFile.name})`, '📄');
    const step2 = progress.addStep(`PDF 이미지 렌더링 (${pdfFile.name})`, '🖼️');
    const step3 = progress.addStep('Gemini Vision 분석 (텍스트 보존 + 서식 반영)', '🤖');
    const step4 = progress.addStep('인크루트 HTML 생성', '✍️');

    state.loading = true;
    try {
      // Step 1: DOCX → HTML + 서식 정보 (백엔드 우선, 브라우저 폴백)
      let docxHtml = '';
      let docxFormattingInfo = null;
      if (state.convertServerAvailable) {
        try {
          const backendResult = await extractViaBackend(docxFile);
          if (backendResult.html && backendResult.html.length > 50) {
            docxHtml = backendResult.html;
            const meta = backendResult.metadata || {};
            if (meta.bold_texts !== undefined || meta.underline_texts !== undefined || meta.bullet_items !== undefined) {
              docxFormattingInfo = {
                boldTexts: meta.bold_texts || [],
                underlineTexts: meta.underline_texts || [],
                bulletItems: meta.bullet_items || []
              };
            }
          }
        } catch (e) { /* 폴백 */ }
      }
      if (!docxHtml) {
        try {
          const browserResult = await extractFromFile(docxFile);
          if (browserResult.html && browserResult.html.length > 50) {
            docxHtml = browserResult.html;
          }
        } catch (e) { /* 실패 */ }
      }
      if (!docxHtml || docxHtml.length < 30) {
        throw new Error('Word 문서에서 텍스트를 추출하지 못했습니다.');
      }
      // 원문 탭에 DOCX 내용 저장
      saveOriginalSource('file', docxHtml, { filename: docxFile.name, format: 'docx', combination: 'docx+pdf' });
      populateOriginalViewer();
      progress.completeStep(step1, `Word 텍스트 추출 완료 (${docxHtml.length.toLocaleString()}자)`);

      // Step 2: PDF → 이미지
      const pdfBase64 = await fileToBase64(pdfFile);
      const { images, totalPages, endPage } = await pdfBase64ToImages(pdfBase64, 10, 3.0);
      const pageNote = totalPages > endPage ? ` (전체 ${totalPages}p 중 ${endPage}p)` : ` (${totalPages}p)`;
      progress.completeStep(step2, `PDF ${images.length}페이지 이미지 추출${pageNote}`);

      // Step 3: Gemini Vision — DOCX 텍스트(절대기준) + PDF 이미지(서식 참조)
      const systemPrompt = await loadGeminiPromptV3();
      const docxTextForPrompt = sanitizeForAI(docxHtml);
      const formattingManifestDocx = extractFormattingManifest(docxHtml, docxFormattingInfo);

      const selectedModel = (state.provider === 'gemini' ? state.model : '') || localStorage.getItem('ai_model_gemini') || 'gemini-2.5-pro';
      const model = selectedModel.startsWith('gemini-') ? selectedModel : 'gemini-2.5-pro';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const userParts = [
        // PDF 이미지 먼저 (서식 참조용)
        ...images.map(img => ({ inline_data: { mime_type: 'image/png', data: img } })),
        {
          text: `위 이미지는 원본 문서의 PDF 렌더링입니다 (색상·볼드·밑줄·정렬·블릿 스타일 참조용).
아래 HTML은 동일 문서의 Word(DOCX)에서 추출한 텍스트 구조입니다 (텍스트 내용의 절대 기준).

## 🚨 텍스트 보존 절대 규칙 (최우선)
1. 텍스트 내용 → Word HTML 기준 (이미지보다 무조건 우선)
2. 텍스트 순서 → Word HTML의 순서 그대로 유지 (재배치 금지)
3. 텍스트 삭제 → 절대 금지. Word에 있는 모든 텍스트는 빠짐없이 포함
4. 텍스트 추가 → 절대 금지. Word에 없는 텍스트는 절대 생성하지 말 것 (환각 금지)
5. 텍스트 수정 → 명백한 오탈자·띄어쓰기만 최소한으로 수정 가능. 의미·단어 변경 금지

## 🎨 스타일 적용 절대 규칙 (반드시 이행)
Word HTML에 포함된 <strong>, <b>, <u> 태그는 원본 문서의 볼드/밑줄 정보입니다. 이 태그들은 반드시 출력 HTML에 그대로 보존해야 합니다.
PDF 이미지는 Word HTML에서 누락된 스타일(색상, 밑줄, 볼드)을 추가로 보완하는 용도입니다.

[스타일 보존 규칙]
1. Word HTML에 <strong>텍스트</strong> 또는 <b>텍스트</b>가 있으면 → 출력에도 반드시 <strong>텍스트</strong> 유지
2. Word HTML에 <u>텍스트</u>가 있으면 → 출력에도 반드시 <u>텍스트</u> 유지
3. PDF 이미지에서 볼드로 보이지만 Word HTML에 <strong>/<b>가 없는 경우 → <strong>텍스트</strong> 추가
4. PDF 이미지에서 밑줄로 보이지만 Word HTML에 <u>가 없는 경우 → <u>텍스트</u> 추가
5. PDF 이미지에서 빨간색 텍스트 → <span class="rt">텍스트</span> (style="color:..." 절대 금지)
6. PDF 이미지에서 파란색 텍스트 → <span class="bt">텍스트</span>
⚠️ 색상 판단 엄격 기준:
- 빨간색(#FF0000, #CC0000 계열, 붉은 계통)일 때만 rt 사용
- 파란색(#0000FF, #0066CC 계열, 푸른 계통)일 때만 bt 사용
- 파란색을 rt로 처리하는 것은 절대 금지 — 파란색은 반드시 bt
- 검정·진한 회색·갈색 볼드 텍스트는 절대 rt/bt로 처리하지 않음
- 볼드(굵기)와 색상(빨강/파랑)은 완전히 별개 — 볼드라고 rt/bt를 추가하지 말 것

[중첩 조합]
- 빨강 + 볼드 + 밑줄 → <span class="rt"><strong><u>텍스트</u></strong></span>
- 빨강 + 볼드 → <span class="rt"><strong>텍스트</strong></span>
- 빨강 + 밑줄 → <span class="rt"><u>텍스트</u></span>
- 볼드 + 밑줄 → <strong><u>텍스트</u></strong>

[한국어 문서 패턴]
- "** "로 시작하는 줄: "** "를 제거하고 전체 문장에 <strong><u>...</u></strong> 적용. 빨간색이면 <span class="rt"><strong><u>...</u></strong></span>

[테이블 및 불릿]
- 테이블 위치: 원본 문서에서의 위치 그대로 유지. 앞뒤 텍스트와의 상대적 위치 절대 변경 금지
- 테이블 정렬: 이미지에서 좌/중/우 정렬 확인 → text-align 적용
- 블릿 종류: 이미지에서 블릿 기호 시각 확인 → 단, 실제 유니코드 문자는 Word HTML 기준

## 우선순위 정리
| 항목 | 기준 |
|------|------|
| 텍스트 내용 | Word HTML (절대) |
| 텍스트 순서·테이블 위치 | Word HTML (절대) |
| 볼드·밑줄 | Word HTML 우선, PDF 이미지로 보완 |
| 색상 | PDF 이미지 |
| 테이블 셀 정렬 | PDF 이미지 |
| 블릿 유니코드 문자 | Word HTML |
| 표 구조·셀 병합 | Word HTML |

[Word 원문 HTML]
${docxTextForPrompt}
${formattingManifestDocx}

위 두 소스를 통합하여 인크루트 표준 HTML로 변환해주세요. Word의 모든 텍스트를 순서대로 빠짐없이 포함하고, 스타일 매니페스트의 볼드/밑줄을 반드시 적용하고, PDF 이미지에서 색상·정렬을 추가 반영하세요.`
        }
      ];

      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536 }
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API 오류 (${resp.status})`);
      }

      const data = await resp.json();
      const visionResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!visionResponse) throw new Error('Gemini Vision 응답이 비어있습니다.');
      progress.completeStep(step3, `Vision 분석 완료 (${model})`);

      // Step 4: HTML 추출 및 미리보기 반영
      const html = extractHtmlFromResponse(visionResponse);
      if (!html || html.length < 50) {
        throw new Error('Gemini Vision 응답에서 HTML을 추출하지 못했습니다.');
      }
      progress.completeStep(step4, `HTML ${html.length.toLocaleString()}자 생성`);

      state.convertedHtml = html;
      updatePreview(html);
      const kvCreated = tryApplyKvJson(visionResponse);
      tryAutoFillKvFromSource(docxHtml);
      setViewAndActivateTab('preview');
      saveSession();  // 리로드 후 복원 가능하도록 저장

      // ── 원문 보존 검증 ──
      const sVerify = progress.addStep('원문 보존 검증', '🔍');
      const verification = verifyConversion(docxHtml, state.convertedHtml);
      const gradeInfo = `${verification.grade} 등급 (${verification.score}/100점, 일치율 ${verification.textMatch}%)`;
      progress.completeStep(sVerify, gradeInfo);

      // 검증 결과를 마지막 메시지에 저장 (Step 14.6 게이트용)
      const lastMsgForVerify = state.messages[state.messages.length - 1];
      if (lastMsgForVerify) lastMsgForVerify.verifyResult = verification;

      if (verification.score < 80) {
        progress.addResult(`⚠ <strong>검증 주의</strong> — 텍스트 일치율 ${verification.textMatch}%. 누락 항목: ${verification.missingTexts.slice(0, 3).map(t => `"${t.substring(0, 20)}"`).join(', ')}${verification.missingTexts.length > 3 ? ` 외 ${verification.missingTexts.length - 3}건` : ''}`);
      }

      const continueNote = totalPages > endPage ? ` (전체 ${totalPages}p 중 ${endPage}p 분석)` : '';
      registerVisionContinue(pdfBase64, endPage, totalPages, docxHtml, pdfBase64ToImages, loadGeminiPromptV3);
      const copyBtns = buildCopyButtons(!!kvCreated);
      const contBtn3 = totalPages > endPage ? buildContinueButton(endPage, totalPages) : '';
      progress.finalize(`Word+PDF Vision 변환 완료${continueNote}`);
      progress.addResult(`✓ <strong>Word+PDF Vision 변환 완료</strong> — Word 텍스트 기준으로 PDF 서식이 반영되었습니다.${copyBtns}${contBtn3}`);

    } catch (err) {
      progress.finalize('Word+PDF Vision 변환 실패');
      addMessage('assistant', `⚠ Word+PDF Vision 변환 실패: ${err.message}`);
    } finally {
      state.loading = false;
    }
  }

  // ============================================================
  // PDF 텍스트 + PDF 이미지 Vision 강화 변환
  // 텍스트 추출(정확한 원문) + PDF 이미지(색상·굵기·밑줄·위치 참조)
  // → Gemini Vision으로 통합 변환
  // ============================================================
  async function handlePdfVisionEnhanced(sourceHtml) {
    // ── v2 파이프라인 토글 (Step 15 — PDF 단독 경로) ──
    if (localStorage.getItem('pipeline_version') === 'v2') {
      if (state.isLoading) return false;
      state.isLoading = true;
      elements.btnConvert.disabled = true;
      elements.btnConvert.innerHTML = '<span class="loading"></span> v2 변환 중...';
      setConvertingTabState(true);
      const progress = createProgressMessage();
      try {
        const { convertV2 } = await import('./v2/index.js');
        const sv2 = progress.addStep('v2 파이프라인 — 구조/텍스트 분리 변환', '🔬');
        const result = await convertV2(sourceHtml, {
          apiKey: state.apiKey,
          model: state.model,
          useIncruitWrapper: true,
          onProgress: (msg) => progress.updateStep(sv2, msg, '🔬')
        });
        state.convertedHtml = result.html;
        elements.sourceEditor.innerHTML = result.html;
        state.sourceContent = result.html;
        updatePreview();
        refreshTitleStyleInPreview();
        const _g = result.verifyReport.grade;
        const _t = result.verifyReport.textMatch;
        progress.completeStep(sv2, `${(result.html.length / 1024).toFixed(1)}KB · ${_g} 등급 · 텍스트 ${_t}%`);
        progress.addResult(`✓ <strong>v2 변환 완료</strong> — ${_g} 등급 (텍스트 일치 ${_t}%)`);
        progress.finalize('v2 변환 완료');
        const lastMsg = state.messages[state.messages.length - 1];
        if (lastMsg) lastMsg.verifyResult = result.verifyReport;
      } catch (err) {
        console.error('[v2 PDF] 오류:', err);
        addMessage('assistant', `v2 파이프라인 오류: ${err.message}`);
      } finally {
        state.isLoading = false;
        elements.btnConvert.disabled = false;
        elements.btnConvert.textContent = '✨ AI 변환';
        setConvertingTabState(false);
      }
      return true; // handled (v2)
    }

    const apiKey = localStorage.getItem('ai_api_key_gemini') || (state.provider === 'gemini' ? state.apiKey : '');
    if (!apiKey) {
      // Gemini 키 없으면 일반 변환으로 fallback (호출자가 처리)
      return false;
    }

    if (!state.pdfPageImages || state.pdfPageImages.length === 0) return false;

    if (state.isLoading) return false;
    state.isLoading = true;
    elements.btnConvert.disabled = true;
    elements.btnConvert.innerHTML = '<span class="loading"></span> 변환 중...';
    setConvertingTabState(true);

    const progress = createProgressMessage();
    const step1 = progress.addStep('PDF 텍스트 구조 준비', '📄');
    const step2 = progress.addStep(`PDF 페이지 이미지 준비 (${state.pdfPageImages.length}페이지)`, '🖼️');
    const step3 = progress.addStep('Gemini Vision 분석 (텍스트+이미지 교차)', '🤖');
    const step4 = progress.addStep('인크루트 HTML 생성', '✍️');

    try {
      const textHtml = sourceHtml || state.originalSource?.html || state.originalSource?.raw || '';
      if (!textHtml || textHtml.length < 30) {
        throw new Error('PDF 원문 텍스트가 없습니다.');
      }
      progress.completeStep(step1, `텍스트 ${textHtml.length.toLocaleString()}자`);
      progress.completeStep(step2, `${state.pdfPageImages.length}페이지 이미지`);

      const systemPrompt = await loadGeminiPromptV3();
      const textForPrompt = sanitizeForAI(textHtml);

      const selectedModel = localStorage.getItem('ai_model_gemini') || (state.provider === 'gemini' ? state.model : '') || 'gemini-2.5-pro';
      const model = selectedModel.startsWith('gemini-') ? selectedModel : 'gemini-2.5-pro';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const userParts = [
        // PDF 이미지 먼저 (시각 참조: 색상·굵기·밑줄·정렬·위치)
        ...state.pdfPageImages.map(img => ({ inline_data: { mime_type: 'image/png', data: img } })),
        {
          text: `위 이미지는 원본 PDF 문서의 페이지 렌더링입니다 (색상·굵기·밑줄·정렬·위치 참조용).
아래 HTML은 동일 PDF에서 추출한 텍스트 구조입니다 (텍스트 내용 기준).

[우선순위 규칙]
1. 텍스트 내용 → 아래 HTML 기준 (이미지보다 우선, 오탈자 없이 그대로)
2. 색상·굵기·밑줄·기울임·정렬 → 이미지(PDF) 기준으로 반영
3. 표 구조·셀 병합 → 아래 HTML 기준 (이미지와 다를 경우 텍스트 우선)
4. 위치가 잘못되어 보이는 경우 → 이미지를 기준으로 올바른 위치에 배치
5. 불릿/리스트 기호 종류 → 아래 HTML의 실제 문자 기준 (이미지 시각 분석으로 추정 금지)

[PDF 추출 텍스트 HTML]
${textForPrompt}

위 두 소스를 통합하여 인크루트 표준 HTML로 변환해주세요.`
        }
      ];

      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: userParts }],
        generationConfig: { temperature: 0, maxOutputTokens: 65536 }
      };

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Gemini API 오류 (${resp.status})`);
      }

      const data = await resp.json();
      const visionResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!visionResponse) throw new Error('Gemini Vision 응답이 비어있습니다.');
      progress.completeStep(step3, `Vision 분석 완료 (${model})`);

      const html = extractHtmlFromResponse(visionResponse);
      if (!html || html.length < 50) throw new Error('Gemini Vision 응답에서 HTML을 추출하지 못했습니다.');
      progress.completeStep(step4, `HTML ${html.length.toLocaleString()}자 생성`);

      state.convertedHtml = html;
      updatePreview(html);
      const kvCreated = tryApplyKvJson(visionResponse);
      tryAutoFillKvFromSource(state.originalSource?.html || '');
      setViewAndActivateTab('preview');
      saveSession();  // 리로드 후 복원 가능하도록 저장

      const copyBtns = buildCopyButtons(!!kvCreated);
      progress.finalize('PDF Vision 강화 변환 완료');
      progress.addResult(`✓ <strong>PDF Vision 강화 변환 완료</strong> — 색상·굵기·밑줄이 이미지 기준으로 반영되었습니다.${copyBtns}`);
      return true;

    } catch (err) {
      progress.finalize('PDF Vision 강화 변환 실패');
      addMessage('assistant', `⚠ PDF Vision 강화 변환 실패: ${err.message}`);
      return true; // 실패해도 true 반환 (일반 변환으로 fallback 방지)
    } finally {
      state.isLoading = false;
      elements.btnConvert.disabled = false;
      elements.btnConvert.innerHTML = '채용공고 변환';
      setConvertingTabState(false);
    }
  }

  // PDF Vision 강화 변환 함수를 전역에 노출 (handleConvert에서 호출 가능하도록)
  window._handlePdfVisionEnhanced = handlePdfVisionEnhanced;

  // ============================================
  // KV 이미지 대화형 편집
  // ============================================
  const KV_IMAGE_CHAT_PATTERN = /배경\s*(이미지|사진|그림|바꿔|변경|교체|추천)|이미지\s*(바꿔|변경|교체|추천|넣어|적용|검색)|다른\s*(배경|이미지|사진)/i;

  async function handleKvImageChat(message) {
    state.isLoading = true;
    state._loadingWsId = getActiveId();
    if (sendBtn) sendBtn.disabled = true;
    setSendButtonLoading(true);

    const pendingMsg = { role: 'assistant', content: '<span class="kv-chat-searching">🔍 이미지 검색 중...</span>', timestamp: new Date() };
    state.messages.push(pendingMsg);
    renderMessages();

    try {
      // 1. AI로 검색 키워드 추출
      let keyword = '';
      if (state.apiKey) {
        try {
          const kwPrompt = `사용자가 채용공고 키비주얼(KV) 배경 이미지를 바꾸려 합니다.\n요청: "${message}"\n\nUnsplash 이미지 검색에 쓸 영어 키워드를 1~3단어로만 답하세요. 예: modern office / technology abstract / business team`;
          keyword = (await callAI(kwPrompt)).trim().replace(/["'`]/g, '').split('\n')[0].trim();
        } catch (e) {
          console.warn('[KvImageChat] AI 키워드 추출 실패:', e);
        }
      }
      if (!keyword) {
        keyword = message
          .replace(/배경|이미지|사진|바꿔|변경|교체|추천|검색|넣어|적용|으로|로|해줘|해주세요|KV|키비주얼/g, ' ')
          .replace(/\s+/g, ' ').trim() || 'office';
      }

      // 2. 이미지 검색
      const apiKeys = {
        unsplashKey: state.unsplashApiKey || '',
        pexelsKey: state.pexelsApiKey || '',
        pixabayKey: state.pixabayApiKey || '',
      };
      const results = await searchKvImagesLib('', keyword, apiKeys);

      if (!results || results.length === 0) {
        pendingMsg.content = `**"${keyword}"** 검색 결과가 없습니다. 다른 키워드로 다시 시도해보세요.`;
        renderMessages();
        return;
      }

      // 3. 상위 4개 썸네일 표시
      const top4 = results.slice(0, 4);
      const gridHtml = top4.map(img => {
        const srcBadge = img.source === 'unsplash' ? 'U' : img.source === 'pexels' ? 'P' : 'Px';
        return `<div class="kv-chat-img-item" data-kv-img-url="${escapeHtml(img.fullUrl || '')}" onclick="window.applyKvChatImage(this)" title="${escapeHtml(img.credit || '')}">
          <img src="${escapeHtml(img.thumbnailUrl || '')}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
          <span class="kv-chat-img-badge">${srcBadge}</span>
        </div>`;
      }).join('');

      pendingMsg.content = `**"${keyword}"** 검색 결과입니다. 클릭하면 KV 배경에 바로 적용됩니다.\n<div class="kv-chat-img-grid">${gridHtml}</div>`;
      renderMessages();

    } catch (e) {
      pendingMsg.content = `이미지 검색 중 오류가 발생했습니다: ${e.message}`;
      renderMessages();
    } finally {
      state.isLoading = false;
      state._loadingWsId = null;
      if (sendBtn) sendBtn.disabled = !(input.value.trim() || attachedFileText);
      setSendButtonLoading(false);
    }
  }

  // Send message
  async function handleAiSend() {
    const originWsId = getActiveId(); // 워크스페이스 바인딩
    let content = input.value.trim();
    if (attachedFileMention) {
      content = content.replace(attachedFileMention, '').trim();
    }
    if (!content && !attachedFileText && !attachedFiles.length) return;

    // HWP+PDF / DOCX+PDF 조합: 변환 관련 키워드 또는 빈 입력이면 combinedVision 실행
    const hwpFile = attachedFiles.find(f => ['hwp', 'hwpx'].includes(f.name.split('.').pop().toLowerCase()));
    const docxFile2 = attachedFiles.find(f => ['doc', 'docx'].includes(f.name.split('.').pop().toLowerCase()));
    const pdfFile = attachedFiles.find(f => f.name.split('.').pop().toLowerCase() === 'pdf');
    if (hwpFile && pdfFile) {
      const isConvertIntent = !content || /변환|convert|만들|작성|생성/i.test(content);
      if (isConvertIntent) {
        addMessage('user', content || `@${hwpFile.name} + @${pdfFile.name} Vision 변환`);
        input.value = '';
        input.style.height = 'auto';
        const hw = hwpFile, pd = pdfFile;
        clearFileAttachment();
        handleHwpPdfCombinedVision(hw, pd);
        return;
      }
    }
    if (docxFile2 && pdfFile) {
      const isConvertIntent = !content || /변환|convert|만들|작성|생성/i.test(content);
      if (isConvertIntent) {
        addMessage('user', content || `@${docxFile2.name} + @${pdfFile.name} Vision 변환`);
        input.value = '';
        input.style.height = 'auto';
        const dx = docxFile2, pd = pdfFile;
        clearFileAttachment();
        handleDocxPdfCombined(dx, pd);
        return;
      }
    }

    // 로딩 중이면 중복 실행 방지 (단, URL 감지는 먼저 체크)
    const detectedUrls = extractUrlsFromText(content);

    // 현재 워크스페이스에서 로딩 중이면 차단, 다른 워크스페이스 백그라운드 작업은 허용
    if (state.isLoading && state._loadingWsId === getActiveId()) return;
    if (state.isLoading && state._loadingWsId !== getActiveId()) {
      addMessage('assistant', `⏳ 다른 작업("${getWorkspaceName(state._loadingWsId)}")에서 AI 변환이 진행 중입니다. 완료 후 다시 시도해주세요.`);
      return;
    }

    // ── 중복 전송 방지 (5초 이내 동일 메시지) ──
    const msgFingerprint = content + '||' + (attachedFileText ? '1' : '0');
    const now = Date.now();
    if (state._lastSentMsg === msgFingerprint && now - (state._lastSentTime || 0) < 5000) {
      console.log('[app] 중복 메시지 차단:', content.substring(0, 50));
      return;
    }
    state._lastSentMsg = msgFingerprint;
    state._lastSentTime = now;

    // KV 이미지 변경 요청 감지
    if (state.kvEnabled && !attachedFileText && KV_IMAGE_CHAT_PATTERN.test(content)) {
      input.value = '';
      addMessage('user', content);
      await handleKvImageChat(content);
      return;
    }

    // URL 자동 감지
    if (detectedUrls.length > 0 && !attachedFileText) {
      input.value = '';
      addMessage('user', `URL 분석 요청: ${detectedUrls.join('\n')}`);
      try {
        await handleUrlExtraction(detectedUrls);
      } catch (e) {
        console.error('[app] URL 추출 미처리 오류:', e);
        addMessage('assistant', `⚠ URL 추출 오류: ${e.message}`);
      } finally {
        // handleUrlExtraction에도 finally가 있지만, 예외 발생 시 안전망
        state.isLoading = false;
        state._loadingWsId = null;
        if (sendBtn) sendBtn.disabled = !(input.value.trim() || attachedFileText);
        setSendButtonLoading(false);
      }
      return;
    }

    const userText = content || '(첨부 파일 내용으로 변환 요청)';
    input.value = '';
    addMessage('user', userText);

    state.isLoading = true;
    state._loadingWsId = originWsId;
    if (sendBtn) sendBtn.disabled = true;
    setSendButtonLoading(true);

    const sourceText = attachedFileText || content;
    const isConversionRequest = sourceText.length > 100 || attachedFileText;
    const _statsId = recordTaskStart(isConversionRequest ? 'ai_convert' : 'chat');

    // 변환 요청이면 진행 과정 표시, 아니면 기존 방식
    const progress = isConversionRequest ? createProgressMessage() : null;

    try {
      // ── Step 1: 원문 분석 ──
      let prompt;
      if (progress) {
        const sourceLen = sourceText.length;
        const sourceType = attachedFileText
          ? (state.originalSource?.metadata?.filename || '첨부 파일')
          : '직접 입력';
        const s1 = progress.addStep(`원문 읽기 — ${sourceType}`, '📄');
        await sleep(200);
        progress.completeStep(s1, `${sourceLen.toLocaleString()}자 · ${state.originalSource?.metadata?.format?.toUpperCase() || 'TEXT'}`);
      }

      // ── Step 2: 프롬프트 구성 ──
      if (progress) {
        const s2 = progress.addStep('변환 프롬프트 구성', '🔧');
        await sleep(150);

        if (isConversionRequest && state.activeSettingsTab === 'keyvisual') {
          prompt = buildKvPrompt(sourceText, content);
          progress.completeStep(s2, '키비주얼 모드');
        } else if (isConversionRequest) {
          prompt = buildConversionPrompt(sourceText, content);
          const tmplName = templates[state.template]?.name || state.template;
          progress.completeStep(s2, `템플릿: ${tmplName} · 불릿: ${state.bulletStyle}`);
        }
      } else {
        if (isConversionRequest && state.activeSettingsTab === 'keyvisual') {
          prompt = buildKvPrompt(sourceText, content);
        } else if (isConversionRequest) {
          prompt = buildConversionPrompt(sourceText, content);
        } else {
          prompt = buildChatPrompt(content);
        }
      }

      // ── Step 3: AI API 호출 (스트리밍 + 라이브 상태) ──
      const providerName = AI_PROVIDERS[state.provider]?.name || state.provider;
      const modelName = state.model || '기본 모델';
      let s3, timerInterval2;
      if (progress) {
        s3 = progress.addStep(`${providerName} API 호출 — ${modelName}`, '🤖');
        const apiStart2 = Date.now();
        const phases2 = [
          { icon: '🤖', text: '프롬프트 분석 중' },
          { icon: '🔍', text: '내용 분석 중' },
          { icon: '📝', text: '응답 생성 중' },
          { icon: '✨', text: '마무리 중' },
        ];
        let phaseIdx2 = 0;
        timerInterval2 = setInterval(() => {
          const elapsed = Math.floor((Date.now() - apiStart2) / 1000);
          const phase = phases2[Math.min(phaseIdx2, phases2.length - 1)];
          progress.updateStep(s3, `${phase.text}... ${elapsed}초`, phase.icon);
          if (elapsed > 0 && elapsed % 5 === 0 && phaseIdx2 < phases2.length - 1) phaseIdx2++;
        }, 1000);
      }

      const response = await callAI(prompt, progress ? (partial) => {
        progress.setStreamingPreview(partial);
      } : null);

      if (timerInterval2) clearInterval(timerInterval2);
      if (progress) progress.clearStreamingPreview();

      if (progress && s3 !== undefined) {
        const tokenEst = Math.round(response.length / 3.5);
        let apiDetail = `응답 ${response.length.toLocaleString()}자 · ~${tokenEst.toLocaleString()} tokens`;
        if (state.lastContinuations > 0) {
          apiDetail += ` (이어쓰기 ${state.lastContinuations}회)`;
        } else if (state.lastContinuations === -1) {
          apiDetail += ' (⚠ 응답 잘림 — 일부 내용 누락 가능)';
        }
        progress.completeStep(s3, apiDetail);
      }

      if (!progress) {
        // 워크스페이스 전환 감지 (비변환 채팅)
        if (getActiveId() !== originWsId) {
          saveBackgroundResult(originWsId, null, response);
          showToast(`"${getWorkspaceName(originWsId)}" 응답 완료`);
          return;
        }
        addMessage('assistant', response);

        // 작업자 이름 자동 감지: AI 응답에 "worker_name" 키워드가 있으면 사용자 입력에서 이름 추출
        if (response.includes('worker_name') || response.includes('기억했')) {
          tryExtractWorkerName(userText);
        }
      }

      // ── 워크스페이스 전환 감지 (변환 요청) ──
      const htmlResult = isConversionRequest ? extractHtmlFromResponse(response) : null;
      if (getActiveId() !== originWsId) {
        if (htmlResult) {
          saveBackgroundResult(originWsId, htmlResult,
            `✓ **채용공고 HTML 변환 완료** (백그라운드)`);
        } else {
          saveBackgroundResult(originWsId, null, response);
        }
        showToast(`"${getWorkspaceName(originWsId)}" 변환 완료`);
        return;
      }
      if (htmlResult) {
        let s4;
        if (progress) {
          s4 = progress.addStep('HTML 템플릿 추출', '📋');
          await sleep(100);
        }

        state.convertedHtml = htmlResult;
        elements.sourceEditor.innerHTML = htmlResult;
        state.sourceContent = htmlResult;
        updatePreview();

        if (progress && s4 !== undefined) {
          const htmlSize = (htmlResult.length / 1024).toFixed(1);
          progress.completeStep(s4, `${htmlSize}KB HTML 생성 · 미리보기 반영 완료`);
        }

        // ── Step 5: 원문 보존 검증 ──
        let s5;
        if (progress) {
          s5 = progress.addStep('원문 보존 검증', '🔍');
          await sleep(100);
        }

        const chatSourceHtml = state.originalSource?.raw || sourceText || '';
        const chatVerification = verifyConversion(chatSourceHtml, htmlResult);

        if (progress && s5 !== undefined) {
          // 진행 단계에는 등급만 간결하게 표시
          const gradeInfo = `${chatVerification.grade} 등급 (${chatVerification.score}/100점, 일치율 ${chatVerification.textMatch}%)`;
          progress.completeStep(s5, gradeInfo);
        }

        // ── Step 6: KV 초안 생성 ──
        const kvCreated = tryAutoFillKvFromSource();
        if (kvCreated) {
          let s6;
          if (progress) {
            s6 = progress.addStep('키비주얼 초안 생성', '🎨');
            await sleep(100);
          }

          const kvTab = document.querySelector('.settings-tab[data-settings-tab="keyvisual"]');
          if (kvTab && !kvTab.querySelector('.kv-ready-badge')) {
            const badge = document.createElement('span');
            badge.className = 'kv-ready-badge';
            badge.textContent = '●';
            badge.style.cssText = 'color:#22c55e;font-size:10px;margin-left:4px;vertical-align:super;';
            kvTab.appendChild(badge);
          }

          if (progress && s6 !== undefined) {
            progress.completeStep(s6, '자동 생성 완료');
          }
        }

        // 최종 결과 표시 — 복사 버튼 포함
        const copyBtns = buildCopyButtons(kvCreated);
        if (progress) {
          progress.addResult('✓ <strong>채용공고 HTML 변환 완료</strong> — 미리보기를 확인해주세요.' + copyBtns);
          progress.finalize('채용공고 HTML 변환 완료');
        } else {
          const chatMsgParts = ['✓ 채용공고 HTML이 생성되었습니다. 미리보기를 확인해주세요.'];
          if (kvCreated) chatMsgParts.push('✓ 키비주얼 초안도 자동 생성되었습니다.');
          chatMsgParts.push('');
          chatMsgParts.push('--- 원문 보존 검증 ---');
          chatMsgParts.push(chatVerification.summary);
          addMessage('assistant', chatMsgParts.join('\n'));
        }

        // 검증 결과를 마지막 메시지에 저장 (Step 14.6 게이트용)
        const lastMsgForChatVerify = state.messages[state.messages.length - 1];
        if (lastMsgForChatVerify) lastMsgForChatVerify.verifyResult = chatVerification;

      } else if (progress) {
        // HTML 추출 실패 — AI 응답만 표시
        progress.addResult(formatMessage(response));
        progress.finalize(response);
      }

      // KV JSON 파싱 — 항상 시도 (AI 응답에 JSON 블록이 있으면 자동 적용)
      tryApplyKvJson(response);

      // 파일 첨부 초기화
      if (attachedFileText) {
        clearFileAttachment();
      }

      // 통계 기록
      recordTaskEnd(_statsId, htmlResult ? '변환 완료' : '채팅 완료');

    } catch (error) {
      recordTaskEnd(_statsId, error.name === 'AbortError' ? '중지' : '오류');
      if (error.name === 'AbortError') {
        if (progress) progress.finalize('사용자가 중지했습니다.');
        // 중지 메시지는 버튼 클릭 핸들러에서 이미 표시됨
      } else if (progress) {
        // 진행 중인 마지막 active step을 실패로 표시
        const activeStep = document.querySelector(`#${progress.id} .progress-step.active`);
        if (activeStep) {
          const stepId = Number(activeStep.dataset.stepId);
          progress.failStep(stepId, error.message);
        }
        progress.addResult(`<span class="text-red-400">⚠ 오류: ${escapeHtml(error.message)}</span>`);
        progress.finalize(`오류: ${error.message}`);
      } else {
        addMessage('assistant', `오류: ${error.message}`);
      }
    } finally {
      if (getActiveId() === originWsId) {
        state.isLoading = false;
        state._loadingWsId = null;
        if (sendBtn) sendBtn.disabled = !(input.value.trim() || attachedFileText);
        setSendButtonLoading(false);
      } else {
        // 백그라운드에서 완료 — 전역 로딩 해제
        state.isLoading = false;
        state._loadingWsId = null;
      }
    }
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      // 로딩 중(정지 버튼 상태)이면 AI 요청 중지
      if (state.isLoading && state._aiAbortController) {
        state._aiAbortController.abort();
        state._aiAbortController = null;
        state.isLoading = false;
        state._loadingWsId = null;
        setSendButtonLoading(false);
        sendBtn.disabled = !(input.value.trim() || attachedFileText);
        addMessage('assistant', '⏹ AI 응답이 중지되었습니다.');
        return;
      }
      triggerSelectedAction();
    });
  }

  if (input) {
    let aiPendingSend = false;
    input.addEventListener('compositionstart', () => {
      aiPendingSend = false;
    });
    input.addEventListener('compositionend', () => {
      if (aiPendingSend) {
        aiPendingSend = false;
        setTimeout(() => triggerSelectedAction(), 0);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.isComposing) {
          e.preventDefault();
          aiPendingSend = true;
          return;
        }
        e.preventDefault();
        setTimeout(() => triggerSelectedAction(), 0);
      }
    });
    // Auto-resize textarea + 텍스트 유무에 따라 보내기 버튼 활성화
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
      // 텍스트가 있으면 보내기 버튼 활성화
      if (sendBtn) {
        sendBtn.disabled = !(input.value.trim() || attachedFileText);
      }
    });
  }

  // File remove button (기존 호환용)
  const removeBtn = document.getElementById('ai-file-remove');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      clearFileAttachment();
    });
  }

  // Drag & drop on input box
  const inputBox = document.querySelector('.ai-input-box');
  if (inputBox) {
    inputBox.addEventListener('dragover', (e) => {
      e.preventDefault();
      inputBox.style.borderColor = '#22c55e';
    });
    inputBox.addEventListener('dragleave', () => {
      inputBox.style.borderColor = '';
    });
    inputBox.addEventListener('drop', (e) => {
      e.preventDefault();
      inputBox.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file) handleFileAttach(file);
    });
  }

  // Quick action buttons — 클릭 시 프롬프트 자동 입력 + 전송 액션 설정
  const quickActionPrompts = {
    'url-analyze': '자료 분석해줘',
    'convert': '채용공고 변환해줘',
    'verify': '검증해줘',
    'add-keyvisual': '키비주얼 추가해줘',
    'summarize': '공고 요약해줘',
    'competencies': '핵심 역량 분석해줘'
  };

  const quickActionToSendAction = {
    'convert': 'convert',
    'verify': 'verify',
    'summarize': 'summarize',
    'competencies': 'competencies'
  };

  document.querySelectorAll('#ai-assistant-body .ai-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const prompt = quickActionPrompts[action] || '';

      if (input) {
        // 파일 첨부 상태면 멘션 포함
        const prefix = attachedFileMention ? `${attachedFileMention} ` : '';
        input.value = `${prefix}${prompt}`;
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;

        // 전송 액션 변경 (convert/verify는 전용 핸들러 사용)
        currentSendAction = quickActionToSendAction[action] || 'send';
        if (sendBtn) sendBtn.disabled = false;
      }
    });
  });

  // Theme toggle
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const theme = btn.dataset.theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('app_theme', theme);
    });
  });

  // Load saved theme
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === savedTheme);
  });

  // ---- AI 페이지 구조 분석 ----

  /**
   * AI 페이지 분석 프롬프트 생성
   */
  function buildPageAnalysisPrompt(analysis) {
    const iframeInfo = analysis.hasIframe
      ? `\n- iframe 발견: ${analysis.iframes.map(f => `id="${f.id}" name="${f.name}" src="${f.src}"`).join(', ')}`
      : '\n- iframe: 없음';

    const nextDataInfo = analysis.hasNextData
      ? `\n- __NEXT_DATA__ (Next.js SSR): 존재\n  주요 키: ${analysis.nextDataKeys.slice(0, 30).join(', ')}\n  pageProps 키: ${(analysis.nextDataPagePropsKeys || []).join(', ')}`
      : '\n- __NEXT_DATA__: 없음';

    const jsonLdInfo = analysis.hasJsonLd
      ? `\n- JSON-LD: @type="${analysis.jsonLdType}"${analysis.jsonLdFields ? ` fields: ${analysis.jsonLdFields.join(', ')}` : ''}`
      : '\n- JSON-LD: 없음';

    const containerInfo = analysis.largeContainers.length > 0
      ? `\n- 주요 컨테이너 (텍스트길이순):\n${analysis.largeContainers.map(c => `  ${c.selector} (text: ${c.textLen}자, html: ${c.htmlLen}자)`).join('\n')}`
      : '\n- 주요 컨테이너: 없음';

    const metaInfo = Object.keys(analysis.metaTags).length > 0
      ? `\n- 메타태그: ${Object.entries(analysis.metaTags).map(([k, v]) => `${k}="${v}"`).join(', ')}`
      : '';

    return `당신은 웹 페이지 구조 분석 전문가입니다. 아래 분석 결과를 바탕으로 이 채용공고 페이지에서 콘텐츠를 추출하는 최적의 파서 설정을 JSON으로 반환하세요.

## 페이지 분석 결과

- URL: ${analysis.url}
- 호스트: ${analysis.hostname}
- 페이지 제목: ${analysis.pageTitle}
- 전체 HTML: ${analysis.rawHtmlLength}자
- 본문 텍스트: ${analysis.totalTextLength}자
${iframeInfo}
${nextDataInfo}
${jsonLdInfo}
${containerInfo}
${metaInfo}

## 반환 형식

다음 JSON을 \`\`\`json 블록 안에 반환하세요:

\`\`\`json
{
  "name": "사이트 이름 (한국어)",
  "strategy": "selector" | "iframe" | "nextdata",
  "selectors": ["#content_selector1", ".content_selector2"],
  "cleanup": ["script", "style", "noscript", "iframe", ".ad_area"],
  "metaSelectors": {
    "title": ["h1", ".job-title"],
    "company": [".company-name"]
  },
  "useJsonLd": false,
  "iframeUrlPattern": "iframe 전략인 경우 URL 패턴 (예: https://example.com/detail?id={param:id})",
  "nextDataPath": "nextdata 전략인 경우 데이터 경로 (예: props.pageProps.jobData)",
  "fieldMapping": { "필드명": "표시 제목" },
  "confidence": 85,
  "reasoning": "판단 근거 설명"
}
\`\`\`

## 판단 기준

1. **iframe 전략**: iframe이 있고, 채용공고 본문이 iframe 안에 있을 가능성이 높은 경우
   - iframeUrlPattern에서 {param:xxx}는 원본 URL의 쿼리 파라미터, {path:n}은 경로 세그먼트 (0부터)
2. **nextdata 전략**: __NEXT_DATA__가 있고, 채용공고 데이터가 JSON에 포함된 경우
   - nextDataPath는 점(.) 구분 경로. 예: "props.pageProps.initialData"
3. **selector 전략**: 일반 HTML 페이지에서 CSS 셀렉터로 추출
   - 가장 큰 텍스트를 가진 고유한 셀렉터를 선택
   - id가 있으면 id 셀렉터 우선, 없으면 class 조합

채용공고 콘텐츠가 들어있을 가능성이 가장 높은 전략과 셀렉터를 선택하세요.
반드시 JSON 블록만 반환하세요. 다른 설명은 필요 없습니다.`;
  }

  /**
   * AI 페이지 분석 오케스트레이터
   * 미지의 URL에 대해 페이지 구조를 분석하고, AI로 파서 설정을 생성하여 동적 등록
   * @param {string} url - 분석 대상 URL
   * @returns {Promise<{ success: boolean, parserConfig?: object, error?: string }>}
   */
  async function handleAiPageAnalysis(url) {
    const hostname = new URL(url).hostname;

    // Step 1: 페이지 구조 분석 (클라이언트 사이드)
    addMessage('assistant', `🔍 **새로운 사이트 감지**: \`${hostname}\`\nAI 자동 페이지 분석을 시작합니다...`);

    const stepMessages = [];
    const analysis = await analyzePageStructure(url, (step, message) => {
      stepMessages.push(`  ${step === 'done' ? '✓' : step === 'error' ? '✗' : '⟳'} ${message}`);
      // 마지막 메시지만 업데이트 (실시간 갱신)
      const lastMsg = document.querySelector('.chat-messages .message:last-child .message-content');
      if (lastMsg) {
        lastMsg.innerHTML = `<p>🔍 <strong>새로운 사이트 감지</strong>: <code>${hostname}</code></p>
<p>페이지 구조 분석 중...</p>
<pre style="font-size:12px;color:var(--text-secondary);margin:8px 0;white-space:pre-wrap;">${stepMessages.join('\n')}</pre>`;
      }
    });

    if (analysis.error) {
      addMessage('assistant', `⚠ 페이지 분석 실패: ${analysis.error}`);
      return { success: false, error: analysis.error };
    }

    // Step 2: 분석 결과 요약 표시
    const summaryParts = [];
    if (analysis.hasIframe) summaryParts.push(`iframe ${analysis.iframes.length}개 발견`);
    if (analysis.hasNextData) summaryParts.push('__NEXT_DATA__ 발견');
    if (analysis.hasJsonLd) summaryParts.push(`JSON-LD (${analysis.jsonLdType})`);
    summaryParts.push(`컨테이너 ${analysis.largeContainers.length}개`);
    summaryParts.push(`본문 ${analysis.totalTextLength.toLocaleString()}자`);

    addMessage('assistant', `📊 **분석 결과**: ${summaryParts.join(' | ')}\n\nAI에게 최적 추출 전략을 요청합니다...`);

    // Step 3: AI에게 프롬프트 전달
    try {
      if (!state.apiKey || !state.provider) {
        addMessage('assistant', '⚠ AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
        return { success: false, error: 'API 키 미설정' };
      }

      const prompt = buildPageAnalysisPrompt(analysis);
      const aiResponse = await callAI(prompt);

      // Step 4: JSON 파싱
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)```/);
      if (!jsonMatch) {
        addMessage('assistant', '⚠ AI 응답에서 파서 설정을 추출하지 못했습니다.');
        return { success: false, error: 'JSON 파싱 실패' };
      }

      const parserConfig = JSON.parse(jsonMatch[1].trim());

      // Step 5: 동적 파서 등록
      registerDynamicParser(hostname, {
        name: parserConfig.name || hostname,
        selectors: parserConfig.selectors || [],
        metaSelectors: parserConfig.metaSelectors || {},
        cleanup: parserConfig.cleanup || ['script', 'style', 'noscript'],
        useJsonLd: parserConfig.useJsonLd || false,
        strategy: parserConfig.strategy || 'selector',
        iframeUrlPattern: parserConfig.iframeUrlPattern || null,
        nextDataPath: parserConfig.nextDataPath || null,
        fieldMapping: parserConfig.fieldMapping || {}
      });

      // Step 6: 결과 표시
      const strategyLabel = {
        'iframe': '🖼️ iframe 콘텐츠 추출',
        'nextdata': '📦 __NEXT_DATA__ JSON 추출',
        'selector': '🎯 CSS 셀렉터 추출'
      }[parserConfig.strategy] || '🎯 CSS 셀렉터 추출';

      addMessage('assistant', `✅ **파서 자동 등록 완료**
- **사이트**: ${parserConfig.name || hostname}
- **전략**: ${strategyLabel}
- **셀렉터**: \`${(parserConfig.selectors || []).join('`, `')}\`
${parserConfig.reasoning ? `- **판단 근거**: ${parserConfig.reasoning}` : ''}

재추출을 시도합니다...`);

      return { success: true, parserConfig };

    } catch (e) {
      addMessage('assistant', `⚠ AI 분석 요청 실패: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  // ---- URL Extraction Handler ----
  let lastExtractResults = null;

  async function handleUrlExtraction(urls) {
    state.isLoading = true;
    const _statsId = recordTaskStart('url_extract');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.classList.add('loading'); }

    const modal = document.getElementById('extract-preview-modal');
    const previewContent = document.getElementById('extract-preview-content');
    const progressEl = document.getElementById('extract-progress');
    const progressBar = document.getElementById('extract-progress-bar');
    const progressLabel = document.getElementById('extract-progress-label');
    const progressCount = document.getElementById('extract-progress-count');
    const metaEl = document.getElementById('extract-meta');
    const warningsEl = document.getElementById('extract-warnings');
    const confidenceEl = document.getElementById('extract-confidence');
    const tabsEl = document.getElementById('extract-tabs');

    // 모달 열기 + 진행률 표시
    if (modal) modal.classList.remove('hidden');
    if (previewContent) previewContent.innerHTML = '<div class="text-center text-gray-400 py-8"><div class="loading-spinner"></div><p class="mt-3">채용공고 추출 중...</p></div>';
    if (progressEl) progressEl.classList.remove('hidden');
    if (metaEl) metaEl.classList.add('hidden');
    if (warningsEl) warningsEl.classList.add('hidden');
    if (tabsEl) tabsEl.classList.add('hidden');

    try {
      const results = await extractFromUrls(urls, (current, total, result) => {
        if (progressBar) progressBar.style.width = `${(current / total) * 100}%`;
        if (progressCount) progressCount.textContent = `${current}/${total}`;
        if (progressLabel) progressLabel.textContent = result.error ? `⚠ URL ${current}` : `✓ URL ${current} 추출 완료`;
      });

      lastExtractResults = results;

      // 진행률 숨기기
      if (progressEl) progressEl.classList.add('hidden');

      // ★ 저신뢰도 결과에 대해 AI 자동 분석 트리거
      const lowConfidenceResults = results.filter(r => !r.error && r.confidence < 60);
      if (lowConfidenceResults.length > 0 && state.apiKey && state.provider) {
        // 모달 임시 숨기기 (AI 분석 중 채팅에 진행 상황 표시)
        if (modal) modal.classList.add('hidden');

        for (const lcResult of lowConfidenceResults) {
          const urlType = detectUrlType(lcResult.url);
          // 이미 알려진 플랫폼이면 건너뜀 (파서가 있지만 신뢰도가 낮은 경우)
          if (urlType !== 'external' && urlType !== 'unknown') continue;

          const aiResult = await handleAiPageAnalysis(lcResult.url);
          if (aiResult.success) {
            // 재추출 시도
            try {
              const reExtracted = await extractFromUrl(lcResult.url);
              // 재추출 결과가 더 좋으면 교체
              if (reExtracted.confidence > lcResult.confidence) {
                const idx = results.indexOf(lcResult);
                results[idx] = { url: lcResult.url, ...reExtracted, error: null };
                addMessage('assistant', `✅ 재추출 성공! 신뢰도: ${lcResult.confidence}% → ${reExtracted.confidence}% (${reExtracted.html.length.toLocaleString()}자)`);
              }
            } catch (e) {
              console.warn('[app] AI 분석 후 재추출 실패:', e.message);
            }
          }
        }

        // 결과 업데이트
        lastExtractResults = results;
        // 모달 다시 표시
        if (modal) modal.classList.remove('hidden');
      }

      // 결과 표시
      const successResults = results.filter(r => !r.error && r.html);
      if (successResults.length === 0) {
        if (previewContent) previewContent.innerHTML = '<div class="text-center text-red-400 py-8"><p>모든 URL에서 추출에 실패했습니다.</p><p class="text-sm mt-2 text-gray-400">' + results.map((r, i) => `URL ${i + 1}: ${r.error || '내용 없음'}`).join('<br>') + '</p></div>';
        addMessage('assistant', '⚠ URL에서 채용공고를 추출하지 못했습니다.');
        return;
      }

      // 복수 URL 탭
      if (successResults.length > 1 && tabsEl) {
        tabsEl.classList.remove('hidden');
        tabsEl.innerHTML = successResults.map((r, i) => {
          const domain = new URL(r.url).hostname.replace('www.', '');
          return `<button class="ai-quick-btn extract-tab ${i === 0 ? 'active' : ''}" data-extract-idx="${i}">${domain}</button>`;
        }).join('');

        tabsEl.querySelectorAll('.extract-tab').forEach(tab => {
          tab.addEventListener('click', () => {
            tabsEl.querySelectorAll('.extract-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            showExtractResult(successResults[Number(tab.dataset.extractIdx)]);
          });
        });
      }

      // 첫 번째 결과 표시
      showExtractResult(successResults[0]);

      addMessage('assistant', `✓ ${successResults.length}개 URL에서 채용공고를 추출했습니다. 미리보기를 확인해주세요.`);

      // 통계 + 히스토리 기록
      recordTaskEnd(_statsId, `${successResults.length}건 추출`);
      for (const r of successResults) {
        try {
          addWorkHistory({
            wsName: getWorkspaceName(getActiveId()),
            jobTitle: r.metadata?.title || '',
            companyName: r.metadata?.company || '',
            action: 'URL 추출',
            source: 'url'
          });
        } catch { /* ignore */ }
      }

    } catch (err) {
      recordTaskEnd(_statsId, '오류');
      if (previewContent) previewContent.innerHTML = `<div class="text-center text-red-400 py-8">${err.message}</div>`;
      addMessage('assistant', `⚠ URL 추출 오류: ${err.message}`);
    } finally {
      state.isLoading = false;
      state._loadingWsId = null;
      // 텍스트 유무 기반으로 버튼 상태 복원
      if (sendBtn) sendBtn.disabled = !(input.value.trim() || attachedFileText);
      setSendButtonLoading(false);
    }
  }

  function showExtractResult(result) {
    const previewContent = document.getElementById('extract-preview-content');
    const metaEl = document.getElementById('extract-meta');
    const warningsEl = document.getElementById('extract-warnings');
    const confidenceEl = document.getElementById('extract-confidence');

    if (previewContent) previewContent.innerHTML = result.html || '<p class="text-gray-400">내용 없음</p>';

    // 메타데이터
    if (metaEl && result.metadata) {
      const meta = result.metadata;
      const parts = [];
      if (meta.title) parts.push(`<strong>제목:</strong> ${meta.title}`);
      if (meta.company) parts.push(`<strong>회사:</strong> ${meta.company}`);
      if (meta.location) parts.push(`<strong>위치:</strong> ${meta.location}`);
      if (meta.source) parts.push(`<strong>출처:</strong> ${meta.source}`);
      if (parts.length > 0) {
        metaEl.innerHTML = parts.join('<br>');
        metaEl.classList.remove('hidden');
      } else {
        metaEl.classList.add('hidden');
      }
    }

    // 경고
    if (warningsEl && result.warnings?.length > 0) {
      warningsEl.innerHTML = result.warnings.map(w => `<div class="text-yellow-400 text-xs mb-1">⚠ ${w}</div>`).join('');
      warningsEl.classList.remove('hidden');
    } else if (warningsEl) {
      warningsEl.classList.add('hidden');
    }

    // 신뢰도 배지
    if (confidenceEl) {
      const score = result.confidence || 0;
      let badgeClass, badgeText;
      if (score >= 80) { badgeClass = 'bg-green-600'; badgeText = '높음'; }
      else if (score >= 50) { badgeClass = 'bg-yellow-600'; badgeText = '보통'; }
      else { badgeClass = 'bg-red-600'; badgeText = '낮음'; }
      confidenceEl.innerHTML = `<span class="px-2 py-0.5 ${badgeClass} rounded text-xs font-medium">${badgeText} ${score}%</span>`;
    }
  }

  // 프리뷰 모달 버튼 핸들러
  document.getElementById('btn-extract-apply')?.addEventListener('click', () => {
    if (lastExtractResults) {
      const successResults = lastExtractResults.filter(r => !r.error && r.html);
      if (successResults.length > 0) {
        const combinedHtml = successResults.map(r => {
          const header = r.metadata?.title ? `<h2>${r.metadata.title}</h2>` : '';
          return header + r.html;
        }).join('<hr style="margin:20px 0;">');

        elements.sourceEditor.innerHTML = combinedHtml;
        state.sourceContent = combinedHtml;
        // 원본 보존
        const firstResult = successResults[0];
        saveOriginalSource('url', combinedHtml, {
          url: firstResult.url,
          title: firstResult.metadata?.title || '',
          company: firstResult.metadata?.company || '',
          urlCount: successResults.length
        });
      
        updateLivePreview();
        addMessage('assistant', '✓ 추출된 내용이 원문 영역에 반영되었습니다. "채용공고 변환" 버튼을 클릭하세요.');
      }
    }
    document.getElementById('extract-preview-modal')?.classList.add('hidden');
  });

  document.getElementById('btn-extract-cancel')?.addEventListener('click', () => {
    document.getElementById('extract-preview-modal')?.classList.add('hidden');
  });

  document.getElementById('btn-extract-retry')?.addEventListener('click', () => {
    if (lastExtractResults) {
      const urls = lastExtractResults.map(r => r.url).filter(Boolean);
      document.getElementById('extract-preview-modal')?.classList.add('hidden');
      if (urls.length > 0) handleUrlExtraction(urls);
    }
  });

  // 모달 배경 클릭으로 닫기
  document.getElementById('extract-preview-modal')?.querySelector('.modal-backdrop')?.addEventListener('click', () => {
    document.getElementById('extract-preview-modal')?.classList.add('hidden');
  });
}

// ============================================
// HTML Code Input Event Listeners
// ============================================
function setupHtmlCodeInput() {
  // 모달 열기 버튼
  document.getElementById('btn-html-code-input')?.addEventListener('click', openHtmlCodeModal);

  // 모달 닫기
  document.getElementById('btn-html-code-close')?.addEventListener('click', closeHtmlCodeModal);
  document.getElementById('btn-html-code-cancel')?.addEventListener('click', closeHtmlCodeModal);
  document.getElementById('html-code-modal')?.querySelector('.modal-backdrop')?.addEventListener('click', closeHtmlCodeModal);

  // 텍스트 변경 시 감지 업데이트 (디바운스 300ms)
  let detectTimer;
  document.getElementById('html-code-textarea')?.addEventListener('input', () => {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(updateHtmlCodeDetection, 300);
  });

  // 원문으로 설정 버튼
  document.getElementById('btn-html-as-source')?.addEventListener('click', () => {
    const textarea = document.getElementById('html-code-textarea');
    if (!textarea?.value.trim()) return;
    processHtmlCodeInput(textarea.value, 'source');
    closeHtmlCodeModal();
  });

  // 코드 편집기로 열기 버튼
  document.getElementById('btn-html-to-editor')?.addEventListener('click', () => {
    const textarea = document.getElementById('html-code-textarea');
    if (!textarea?.value.trim()) return;
    processHtmlCodeInput(textarea.value, 'editor');
    closeHtmlCodeModal();
  });

  // 원문 뷰어 "코드 보기" 토글
  document.getElementById('btn-toggle-code-view')?.addEventListener('click', () => {
    const viewer = document.getElementById('original-viewer');
    const btn = document.getElementById('btn-toggle-code-view');
    if (!viewer || !state.originalSource?.raw) return;

    const isCodeView = viewer.classList.toggle('original-code-view');
    if (isCodeView) {
      // 코드 보기: HTML 소스를 텍스트로 표시
      viewer.textContent = state.originalSource.raw;
      viewer.contentEditable = 'false';
      btn.textContent = '렌더링 보기';
    } else {
      // 렌더링 보기: HTML을 렌더링하여 표시
      viewer.innerHTML = state.originalSource.raw;
      viewer.contentEditable = 'true';
      btn.textContent = '코드 보기';
    }
  });
}

// KV 변환 프롬프트
function buildKvPrompt(sourceText, userRequest) {
  return `당신은 채용공고 키비주얼 이미지의 텍스트 요소를 생성하는 AI 어시스턴트입니다.

입력된 채용 정보에서 다음을 추출하세요:
1. 공고번호 (예: "공고 제2026-123호")
2. 기업명+공고명 (3줄 이내)
3. 회사소개 (3줄 이내)
4. 날짜
5. 기업명

반드시 아래 JSON 형식으로 응답하세요:
\`\`\`json
{
  "jobCode": "공고 제2026-XXX호",
  "title": "기업명\\n공고명\\n상세",
  "description": "회사소개1\\n회사소개2\\n회사소개3",
  "date": "2026년 MM월 DD일",
  "companyName": "기업명"
}
\`\`\`

입력 내용:
${sourceText.substring(0, 4000)}

${userRequest ? `추가 요청: ${userRequest}` : ''}`;
}

function tryApplyKvJson(text) {
  // Try to extract JSON from AI response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*"jobCode"[\s\S]*\}/);
  if (!jsonMatch) return;

  try {
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const data = JSON.parse(jsonStr);

    if (data.jobCode) {
      state.kv.jobCode = data.jobCode;
      document.getElementById('kv-job-code').value = data.jobCode;
    }
    if (data.title) {
      state.kv.title = data.title;
      const _titleEl = document.getElementById('kv-title');
      if (_titleEl) { _titleEl.innerHTML = escapeHtml(data.title).replace(/\n/g, '<br>'); state.kv.titleHtml = _titleEl.innerHTML; }
    }
    if (data.description) {
      state.kv.description = data.description;
      document.getElementById('kv-description').value = data.description;
    }
    if (data.date) {
      state.kv.date = data.date;
    }
    if (data.companyName) {
      state.kv.companyName = data.companyName;
    }
    if (data.date || data.companyName) {
      state.kv.dateCompanyText = (state.kv.date || '') + '\n' + (state.kv.companyName || '');
      const _dcEl = document.getElementById('kv-date-company');
      if (_dcEl) _dcEl.value = state.kv.dateCompanyText;
    }
    if (data.bgImageUrl) {
      state.kv.bgImageUrl = data.bgImageUrl;
      const bgInput = document.getElementById('kv-bg-url');
      if (bgInput) bgInput.value = data.bgImageUrl;
    } else if (data.industry || data.jobType) {
      // AI가 업종/직종을 알려주면 자동 배경 선택
      const autoBg = pickBgImageByKeywords((data.industry || '') + ' ' + (data.jobType || ''));
      state.kv.bgImageUrl = autoBg;
      const bgInput = document.getElementById('kv-bg-url');
      if (bgInput) bgInput.value = autoBg;
    }

    renderKvPreview();
    console.info('[KV AI] JSON에서 자동 채우기 완료:', data);

    // KV 탭에 초록 배지 추가
    const kvTab = document.querySelector('.settings-tab[data-settings-tab="keyvisual"]');
    if (kvTab && !kvTab.querySelector('.kv-ready-badge')) {
      const badge = document.createElement('span');
      badge.className = 'kv-ready-badge';
      badge.textContent = '●';
      badge.style.cssText = 'color:#22c55e;font-size:10px;margin-left:4px;vertical-align:super;';
      kvTab.appendChild(badge);
    }
  } catch (e) {
    console.warn('[KV AI] JSON 파싱 실패:', e);
  }
}

function syncKvState() {
  state.kv.jobCode = document.getElementById('kv-job-code').value;
  const titleEditor = document.getElementById('kv-title');
  if (titleEditor) {
    state.kv.titleHtml = titleEditor.innerHTML;
    state.kv.title = (titleEditor.innerText || titleEditor.textContent || '').replace(/\n$/, '');
  }
  const orgNameEditor = document.getElementById('kv-org-name');
  if (orgNameEditor) {
    state.kv.orgNameHtml = orgNameEditor.innerHTML;
    state.kv.orgName = (orgNameEditor.innerText || orgNameEditor.textContent || '').replace(/\n$/, '');
  }
  state.kv.description = document.getElementById('kv-description').value;
  const desc2El = document.getElementById('kv-description2');
  if (desc2El) state.kv.description2 = desc2El.value;
  const dcEl = document.getElementById('kv-date-company');
  if (dcEl) {
    state.kv.dateCompanyText = dcEl.value;
    const dcLines = dcEl.value.split('\n');
    state.kv.date = dcLines[0] || '';
    state.kv.companyName = dcLines.slice(1).join('\n') || '';
  }
}

let kvPreviewTimer = null;
function debounceKvPreview() {
  clearTimeout(kvPreviewTimer);
  kvPreviewTimer = setTimeout(renderKvPreview, 200);
}

function getTextShadowCss(level) {
  switch (level) {
    case 'light':  return '0 1px 3px rgba(0,0,0,0.35)';
    case 'medium': return '0 1px 5px rgba(0,0,0,0.55)';
    case 'strong': return '0 2px 8px rgba(0,0,0,0.8)';
    default:       return 'none';
  }
}

// 이미지 파일을 Canvas로 리사이징/압축 후 DataURL 반환.
// 500KB 이하: 압축 없이 그대로 반환. PNG: 투명도 보존하여 리사이징만.
function compressImageFile(file) {
  const MAX_PX = 1200;      // KV 배경: 1200px이면 충분 (기존 1920)
  const JPEG_Q = 0.7;       // 품질 70% — 시각 차이 미미, 용량 대폭 절감 (기존 0.85)
  const THRESHOLD = 200 * 1024; // 200KB 이상이면 압축 (기존 500KB)

  // 소용량 파일: FileReader로 바로 반환
  if (file.size <= THRESHOLD) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  // 대용량 파일: ObjectURL로 메모리 효율적으로 로드 후 Canvas 압축
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width: w, height: h } = img;
      if (w > MAX_PX || h > MAX_PX) {
        const ratio = Math.min(MAX_PX / w, MAX_PX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      // 항상 JPEG로 변환 (PNG도 → 투명도 불필요한 KV 배경이므로)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', JPEG_Q));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = () => resolve('');
      r.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}

// ── KV Title Rich HTML Sanitizer ──
function sanitizeTitleHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  let firstDiv = true;
  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent);
    if (node.nodeName === 'BR') return '<br>';
    if (node.nodeName === 'DIV') {
      const inner = Array.from(node.childNodes).map(processNode).join('');
      if (firstDiv) { firstDiv = false; return inner; }
      return '<br>' + inner;
    }
    if (node.nodeName === 'SPAN') {
      const inner = Array.from(node.childNodes).map(processNode).join('');
      const color = node.style.color;
      const fontFamily = node.style.fontFamily;
      const bg = node.style.background || node.style.backgroundImage || '';
      if (bg.includes('gradient')) {
        const dir = bg.match(/linear-gradient\(([^,]+),/)?.[1]?.trim() || '90deg';
        const stops = [];
        const stopRe = /#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\)/g;
        let m;
        while ((m = stopRe.exec(bg)) !== null) stops.push(m[0]);
        const gradCss = stops.length >= 2
          ? `linear-gradient(${dir},${stops.join(',')})`
          : bg;
        // 그라데이션: 부모 폰트 상속
        return `<span style="background:${gradCss};-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:inline-block;padding:0;line-height:inherit;box-decoration-break:clone;-webkit-box-decoration-break:clone;font-size:inherit;font-weight:inherit;font-family:inherit;">${inner}</span>`;
      }
      // 일반 color span도 폰트 상속
      if (color) {
        return `<span style="color:${color};font-size:inherit;font-weight:inherit;font-family:inherit;">${inner}</span>`;
      }
      return inner;
    }
    return Array.from(node.childNodes).map(processNode).join('');
  }
  return Array.from(tmp.childNodes).map(processNode).join('');
}

function renderKvPreview() {
  const kv = state.kv;
  const card = document.getElementById('kv-preview-card');
  const info = document.getElementById('kv-preview-info');
  if (!card) return;

  // Update info text (if element exists)
  if (info) {
    const typeLabel = kv.templateType === 'overlay' ? '오버레이' : (kv.templateType === 'photoTop' || kv.templateType === 'photoTop2' || kv.templateType === 'photoFull') ? '실사공고' : '분리형';
    const alignLabel = { left: '좌측 정렬', center: '센터 정렬', right: '우측 정렬' }[kv.textAlign];
    const effectLabel = { none: '효과 없음', gradient: '그라데이션', diagonal: '사선', curve: '곡선' }[kv.effect];
    const heightLabel = kv.heightMode === 'fixed' ? '고정 높이' : '유동 높이';
    info.textContent = `${typeLabel} | ${alignLabel} | ${effectLabel} | ${heightLabel}`;
  }

  // Determine background image
  const bgImage = kv.bgImageDataUrl || kv.bgImageUrl || '';

  // Build effect class
  const effectClass = kv.effect !== 'none' ? `kv-effect-${kv.effect}` : '';
  const splitClass = kv.templateType === 'split' ? 'kv-split' : '';

  // Height style
  const heightStyle = kv.heightMode === 'fixed' ? 'aspect-ratio: 16/9;' : 'min-height: 300px;';

  // Title lines (rich text support)
  const orgNameLines = sanitizeTitleHtml(kv.orgNameHtml || escapeHtml(kv.orgName || '').replace(/\n/g, '<br>'));
  const titleLines = sanitizeTitleHtml(kv.titleHtml || escapeHtml(kv.title).replace(/\n/g, '<br>'));
  const descLines = escapeHtml(kv.description).replace(/\n/g, '<br>');
  const desc2Lines = escapeHtml(kv.description2 || '').replace(/\n/g, '<br>');

  // Logo HTML
  const logoHtml = kv.logoDataUrl
    ? `<img src="${kv.logoDataUrl}" class="kv-logo-img" alt="Logo">`
    : '';

  // Field styles
  const fs = kv.fieldStyles || {};
  const shadowCss = `text-shadow:${getTextShadowCss(kv.textShadow)};`;
  const jobCodeStyle = fs.jobCode ? `font-size:${fs.jobCode.fontSize}px; color:${fs.jobCode.color}; font-weight:${fs.jobCode.fontWeight ?? (fs.jobCode.bold ? 700 : 400)}; font-family:'${fs.jobCode.fontFamily || 'Pretendard Variable'}',sans-serif; text-align:${fs.jobCode.align || 'inherit'}; ${shadowCss}` : '';
  const orgNameStyle = fs.orgName ? `font-size:${fs.orgName.fontSize}px; color:${fs.orgName.color}; font-weight:${fs.orgName.fontWeight ?? (fs.orgName.bold ? 700 : 400)}; font-family:'${fs.orgName.fontFamily || 'Pretendard Variable'}',sans-serif; text-align:${fs.orgName.align || 'inherit'}; ${fs.orgName.lineHeight ? `line-height:${fs.orgName.lineHeight};` : ''}${shadowCss}` : '';
  const titleStyle = fs.title ? `font-size:${fs.title.fontSize}px; color:${fs.title.color}; font-weight:${fs.title.fontWeight ?? (fs.title.bold ? 700 : 400)}; font-family:'${fs.title.fontFamily || 'Pretendard Variable'}',sans-serif; text-align:${fs.title.align || 'inherit'}; ${fs.title.lineHeight ? `line-height:${fs.title.lineHeight};` : ''}${fs.title.marginBottom != null ? `margin-bottom:${fs.title.marginBottom}px;` : ''}${fs.title.letterSpacing ? `letter-spacing:${fs.title.letterSpacing};` : ''}${shadowCss}` : '';
  const descStyle = fs.description ? `font-size:${fs.description.fontSize}px; color:${fs.description.color}; font-weight:${fs.description.fontWeight ?? (fs.description.bold ? 600 : 400)}; font-family:'${fs.description.fontFamily || 'Pretendard Variable'}',sans-serif; text-align:${fs.description.align || 'inherit'}; ${fs.description.lineHeight ? `line-height:${fs.description.lineHeight};` : ''}${fs.description.marginTop ? `margin-top:${fs.description.marginTop}px;` : ''}${fs.description.marginBottom != null ? `margin-bottom:${fs.description.marginBottom}px;` : ''}${fs.description.letterSpacing ? `letter-spacing:${fs.description.letterSpacing};` : ''}${shadowCss}` : '';
  const footerStyle = fs.dateCompany ? `font-size:${fs.dateCompany.fontSize}px; color:${fs.dateCompany.color}; font-weight:${fs.dateCompany.fontWeight ?? (fs.dateCompany.bold ? 600 : 400)}; font-family:'${fs.dateCompany.fontFamily || 'Pretendard Variable'}',sans-serif; text-align:${fs.dateCompany.align || 'inherit'}; ${fs.dateCompany.lineHeight ? `line-height:${fs.dateCompany.lineHeight};` : ''}${fs.dateCompany.marginTop ? `margin-top:${fs.dateCompany.marginTop}px;` : ''}${fs.dateCompany.marginBottom != null ? `margin-bottom:${fs.dateCompany.marginBottom}px;` : ''}${fs.dateCompany.letterSpacing ? `letter-spacing:${fs.dateCompany.letterSpacing};` : ''}${shadowCss}` : '';
  const desc2Style = fs.description2 ? `font-size:${fs.description2.fontSize}px; color:${fs.description2.color}; font-weight:${fs.description2.fontWeight ?? (fs.description2.bold ? 600 : 400)}; font-family:'${fs.description2.fontFamily || 'Pretendard Variable'}',sans-serif; ${fs.description2.lineHeight ? `line-height:${fs.description2.lineHeight};` : ''}${fs.description2.marginTop ? `margin-top:${fs.description2.marginTop}px;` : ''}${fs.description2.marginBottom != null ? `margin-bottom:${fs.description2.marginBottom}px;` : ''}` : '';

  // Text position (only for fixed height + overlay)
  const usePosition = kv.heightMode === 'fixed' && kv.templateType !== 'split';
  const pos = kv.textPosition || {};
  const posClass = usePosition ? ' kv-position-mode' : '';
  // 기준 카드 크기 (position 슬라이더 값 기준)
  const refW = 600, refH = 337.5;
  const toPct = (px, ref) => (px / ref * 100).toFixed(2) + '%';
  const jobCodePosStyle = usePosition && pos.jobCode ? `left:${toPct(pos.jobCode.left, refW)}; top:${toPct(pos.jobCode.top, refH)};` : '';
  const titlePosStyle = usePosition && pos.title ? `left:${toPct(pos.title.left, refW)}; top:${toPct(pos.title.top, refH)};` : '';
  const descPosStyle = usePosition && pos.description ? `left:${toPct(pos.description.left, refW)}; top:${toPct(pos.description.top, refH)};` : '';
  const footerPosStyle = usePosition && pos.dateCompany ? `left:${toPct(pos.dateCompany.left, refW)}; top:${toPct(pos.dateCompany.top, refH)};` : '';

  if (kv.templateType === 'photoFull') {
    // Full-bleed photo with all content overlay (실사공고03 계열)
    const accentColor = kv.titleAccentColor || '';
    const orgBoxBorderStyle = accentColor ? `border:2px solid ${accentColor};` : '';
    const titleHtmlInner = sanitizeTitleHtml(kv.titleHtml || escapeHtml(kv.title).replace(/\n/g, '<br>'));
    const _bgSz = kv.photoBgSize ?? 100; const _bgPx = kv.photoBgPosX ?? 50; const _bgPy = kv.photoBgPosY ?? 50;
    const bgImageStyle = bgImage ? `background-image: url('${bgImage}'); background-size: ${_bgSz}%; background-position: ${_bgPx}% ${_bgPy}%;` : '';
    const jobCodeTop = kv.photoJobCodeTop ?? 5;
    // 공고번호: 텍스트 정렬 추출 (jobCodeStyle에서 text-align 적용)
    const jcAlign = (fs.jobCode?.align) || kv.textAlign || 'center';
    const isLeftAlign = kv.textAlign === 'left';
    const contentAlignItems = isLeftAlign ? 'flex-start' : 'center';
    const contentTextAlign = isLeftAlign ? 'left' : 'center';

    const rTL = kv.photoRadiusTL ?? 0, rTR = kv.photoRadiusTR ?? 0;
    const rBR = kv.photoRadiusBR ?? 0, rBL = kv.photoRadiusBL ?? 0;
    const cardRadiusStyle = (rTL || rTR || rBR || rBL) ? ` border-radius: ${rTL}px ${rTR}px ${rBR}px ${rBL}px; overflow: hidden;` : '';
    const _hf = kv.hiddenFields || [];
    card.className = `kv-card kv-photo-full kv-align-${kv.textAlign}`;
    card.style.cssText = `background-color: ${kv.bgColor || '#0a0f1e'};${cardRadiusStyle}`;
    card.innerHTML = `
      <div class="kv-photo-full-bg" style="${bgImageStyle}"></div>
      <div class="kv-photo-full-overlay"></div>
      ${!_hf.includes('jobCode') ? `<div class="kv-job-code kv-photo-full-jobcode" style="top:${jobCodeTop}%; text-align:${jcAlign}; ${jobCodeStyle}">${escapeHtml(kv.jobCode)}</div>` : ''}
      <div class="kv-photo-full-content" style="position:relative !important; z-index:1 !important; display:flex !important; flex-direction:column !important; align-items:${contentAlignItems}; justify-content:${kv.photoVerticalAlign === 'bottom' ? 'flex-end' : 'center'}; padding:${kv.photoContentPadding || '5% 6%'} !important; min-height:${kv.photoContentMinHeight || 320}px !important; text-align:${contentTextAlign};">
        <div class="kv-org-name-box" style="padding:0; margin-top:${kv.photoOrgNameMarginTop ?? (isLeftAlign ? '9.2%' : '5%')}; ${orgBoxBorderStyle}">
          <div class="kv-org-name-text" style="${orgNameStyle}; margin-bottom:${isLeftAlign ? '0' : '5px'};">${orgNameLines}</div>
        </div>
        <div class="kv-title-text" style="${titleStyle}; ${fs.title?.lineHeight ? '' : 'line-height:1.25;'} margin-bottom:${isLeftAlign ? '0' : '14px'};">${titleHtmlInner}</div>
        ${!_hf.includes('description') ? `<div class="kv-desc-text" style="${descStyle}; ${fs.description?.lineHeight ? '' : 'line-height:1.2;'}${kv.photoDescMargin != null ? ` margin:${kv.photoDescMargin};` : ` margin-bottom:${desc2Lines ? '0' : '69px'};`} text-align:${contentTextAlign};">${descLines}</div>` : ''}
        ${desc2Lines && !_hf.includes('description') ? `<div class="kv-desc-text-2" style="${desc2Style} text-align:${contentTextAlign};${fs.description2?.marginBottom == null ? ' margin-bottom:0;' : ''}">${desc2Lines}</div>` : ''}
        ${!_hf.includes('dateCompany') ? `<div class="kv-footer-text" style="${footerStyle}${kv.photoFooterMargin != null ? ` margin:${kv.photoFooterMargin};` : ''}">
          ${(kv.dateCompanyText != null ? kv.dateCompanyText : (kv.date + '\n' + kv.companyName)).split('\n').map(l => escapeHtml(l)).join('<br>')}
        </div>` : ''}
      </div>
    `;
  } else if (kv.templateType === 'photoTop') {
    // Photo-top, white-content-bottom layout (실사공고01)
    const photoBg = kv.photoContentBg || '#F6F6F6';
    card.className = `kv-card kv-photo-top kv-align-${kv.textAlign}`;
    card.style.cssText = `background-color: ${photoBg};`;

    // 공고제목: rich text HTML 사용
    const titleHtmlInner = sanitizeTitleHtml(kv.titleHtml || escapeHtml(kv.title).replace(/\n/g, '<br>'));

    const bgSize = kv.photoBgSize ?? 100;
    const bgPosX = kv.photoBgPosX ?? 50;
    const bgPosY = kv.photoBgPosY ?? 50;
    const bgImageStyle = bgImage
      ? `background-image: url('${bgImage}'); background-size: ${bgSize}%; background-position: ${bgPosX}% ${bgPosY}%;`
      : '';

    const jobCodeTop = kv.photoJobCodeTop ?? 5;
    const imgH = kv.photoImgHeight || null;
    let imgHeightStyle = '';
    if (imgH !== null) {
      if (typeof imgH === 'string' && imgH.endsWith('%')) {
        const pct = parseFloat(imgH);
        imgHeightStyle = `flex: 0 0 auto; width: 100%; aspect-ratio: 100 / ${pct};`;
      } else {
        imgHeightStyle = `flex: 0 0 ${imgH}px; height: ${imgH}px;`;
      }
    }
    const rBL = (kv.photoRadiusBL !== undefined && kv.photoRadiusBL !== null) ? kv.photoRadiusBL : null;
    const rBR = (kv.photoRadiusBR !== undefined && kv.photoRadiusBR !== null) ? kv.photoRadiusBR : null;
    const imgRadiusStyle = (rBL !== null || rBR !== null) ? `border-radius: 0 0 ${rBR ?? 80}px ${rBL ?? 80}px;` : '';
    const ctrR = kv.photoContentTopRadius || 0;
    const ctrTL = kv.photoContentRadiusTL || 0;
    const ctrTR = kv.photoContentRadiusTR || 0;
    const hasBorderRadius = ctrR || ctrTL || ctrTR;
    const contentBorderRadius = hasBorderRadius ? `border-radius: ${ctrTL || ctrR}px ${ctrTR || ctrR}px 0 0;` : '';
    // fullBg 모드: 카드 자체가 배경 이미지, 이미지 div는 투명 스페이서
    const useFullBg = kv.photoFullBg && bgImage;

    // S커브 모드: ::before 역할을 하는 radial-gradient div로 S자 곡선 연결
    const useSCurve = !useFullBg && ctrTR > 0 && ctrTL === 0 && ctrR === 0;
    const sCurveHtml = useSCurve
      ? `<div style="position:absolute; top:-${ctrTR}px; left:0; width:${ctrTR}px; height:${ctrTR}px; background:radial-gradient(circle at 100% 0%, transparent ${ctrTR}px, ${photoBg} ${ctrTR + 1}px); pointer-events:none;"></div>`
      : '';
    const contentFloatStyle = ctrR
      ? `background-color: ${photoBg}; ${contentBorderRadius} margin-top: -${ctrR}px; position: relative; z-index: 1;`
      : useSCurve
        ? `background-color: ${photoBg}; border-top-right-radius: ${ctrTR}px; margin-top: -${ctrTR}px; position: relative; z-index: 1; overflow: visible;`
        : `background-color: ${photoBg}; ${contentBorderRadius}`;
    if (useFullBg) {
      card.style.cssText = `background-image: url('${bgImage}'); background-size: cover; background-position: center; background-color: ${photoBg};`;
    }

    // fullBg 모드에서 이미지 좌하단 라운딩: 컨텐츠 배경색으로 코너 채우기
    const cornerFillHtml = (useFullBg && ctrTL > 0)
      ? `<div style="position:absolute; bottom:0; left:0; width:${ctrTL}px; height:${ctrTL}px; background-color:${photoBg}; border-top-left-radius:${ctrTL}px;"></div>`
      : '';

    // position:relative 인라인 명시 — 다운로드 HTML에서 CSS 클래스 누락/순위 이슈로
    // 자식 kv-job-code(absolute)가 body 기준으로 탈출해 왼쪽 끝에 붙는 버그 방지.
    const imgDivStyle = useFullBg
      ? `position:relative; overflow:visible; border-radius:0; ${imgHeightStyle} background-color: transparent; background-image: none;`
      : `position:relative; ${bgImageStyle}${imgHeightStyle}${imgRadiusStyle}`;
    card.innerHTML = `
      <div class="kv-photo-top-image" style="${imgDivStyle}">
        ${cornerFillHtml}
        ${useFullBg ? '' : '<div class="kv-photo-overlay"></div>'}
        <div class="kv-job-code" style="position:absolute;top:${jobCodeTop}%;left:0;right:0;padding-top:0;padding-right:4.9%;padding-bottom:0;padding-left:4.9%;z-index:1;${jobCodeStyle}">${escapeHtml(kv.jobCode)}</div>
      </div>
      <div class="kv-photo-top-content" style="${contentFloatStyle}">
        ${sCurveHtml}
        ${logoHtml}
        <div class="kv-org-name-text" style="${orgNameStyle}">${orgNameLines}</div>
        <div class="kv-title-text" style="${titleStyle}">${titleHtmlInner}</div>
        <div class="kv-desc-text" style="${descStyle}">${descLines}</div>
        <div class="kv-footer-text" style="${footerStyle}">
          ${(kv.dateCompanyText != null ? kv.dateCompanyText : (kv.date + '\n' + kv.companyName)).split('\n').map(l => escapeHtml(l)).join('<br>')}
        </div>
      </div>
    `;
  } else if (kv.templateType === 'photoTop2') {
    // Photo-top with text overlay at bottom of image + dark content area (실사공고02)
    const photoBg = kv.photoContentBg || '#111111';
    card.className = `kv-card kv-photo-top2 kv-align-${kv.textAlign}`;
    const titleHtmlInner = sanitizeTitleHtml(kv.titleHtml || escapeHtml(kv.title).replace(/\n/g, '<br>'));
    const _bgSz = kv.photoBgSize ?? 100; const _bgPx = kv.photoBgPosX ?? 50; const _bgPy = kv.photoBgPosY ?? 50;
    const bgImageStyle = bgImage ? `background-image: url('${bgImage}'); background-size: ${_bgSz}%; background-position: ${_bgPx}% ${_bgPy}%;` : '';
    const jobCodeTop = kv.photoJobCodeTop ?? 5;
    const rTL = kv.photoRadiusTL ?? 0, rTR = kv.photoRadiusTR ?? 0;
    const rBR = kv.photoRadiusBR ?? 0, rBL = kv.photoRadiusBL ?? 0;
    const imgRadiusStyle = `border-radius: ${rTL}px ${rTR}px ${rBR}px ${rBL}px;`;
    // 하단 라운딩 곡선 영역부터 배경색 적용 (상단 코너는 투명 유지)
    const bgCutoff = 380 - Math.max(rBL, rBR);
    card.style.cssText = `background: linear-gradient(to bottom, transparent ${bgCutoff}px, ${photoBg} ${bgCutoff}px);`;

    card.innerHTML = `
      <div class="kv-photo-top-image" style="position:relative; ${bgImageStyle} ${imgRadiusStyle}">
        <div class="kv-job-code" style="position:absolute;top:${jobCodeTop}%;left:0;right:0;padding-top:0;padding-right:4.9%;padding-bottom:0;padding-left:4.9%;z-index:1;${jobCodeStyle}">${escapeHtml(kv.jobCode)}</div>
        <div class="kv-photo-bottom-overlay" style="position:absolute;bottom:0;left:0;right:0;padding-top:0;padding-right:4.9%;padding-bottom:3.9%;padding-left:4.9%;z-index:1;">
          <div class="kv-org-name-text" style="${orgNameStyle}">${orgNameLines}</div>
          <div class="kv-title-highlight"><div class="kv-title-text" style="${titleStyle}">${titleHtmlInner}</div></div>
        </div>
      </div>
      <div class="kv-photo-top-content kv-photo-top2-content" style="background-color: ${photoBg};">
        ${logoHtml}
        <div class="kv-desc-text" style="${descStyle}">${descLines}</div>
        <div class="kv-footer-text" style="${footerStyle}">
          ${(kv.dateCompanyText != null ? kv.dateCompanyText : (kv.date + '\n' + kv.companyName)).split('\n').map(l => escapeHtml(l)).join('<br>')}
        </div>
      </div>
    `;
  } else if (kv.templateType === 'split') {
    // Split layout
    const layout = kv.splitLayout || 'text-left';
    card.className = `kv-card kv-split kv-layout-${layout} ${effectClass} kv-align-${kv.textAlign}`;
    card.style.cssText = `${heightStyle} --kv-brand-color: ${kv.brandColor};`;
    card.innerHTML = `
      <div class="kv-card-bg" style="background-color: ${kv.bgColor}; ${bgImage ? `background-image: url('${bgImage}'); background-size: cover; background-position: center;` : ''}">
        <div class="kv-card-overlay"></div>
      </div>
      <div class="kv-card-content align-${kv.textAlign}" style="background-color: ${kv.brandColor};">
        ${logoHtml}
        <div class="kv-job-code" style="${jobCodeStyle}">${escapeHtml(kv.jobCode)}</div>
        <div class="kv-title-text" style="${titleStyle}">${titleLines}</div>
        <div class="kv-desc-text" style="${descStyle}">${descLines}</div>
        <div class="kv-footer-text" style="${footerStyle}">
          ${(kv.dateCompanyText != null ? kv.dateCompanyText : (kv.date + '\n' + kv.companyName)).split('\n').map(l => escapeHtml(l)).join('<br>')}
        </div>
      </div>
    `;
  } else {
    // Overlay layout
    card.className = `kv-card ${effectClass}${posClass} kv-align-${kv.textAlign}`;
    card.style.cssText = `${heightStyle} background-color: ${kv.bgColor}; --kv-brand-color: ${kv.brandColor};`;
    card.innerHTML = `
      ${bgImage ? `<div class="kv-card-bg" style="background-image: url('${bgImage}');"></div>` : ''}
      <div class="kv-card-overlay"></div>
      <div class="kv-card-content align-${kv.textAlign}">
        ${logoHtml}
        <div class="kv-job-code" style="${jobCodeStyle} ${jobCodePosStyle}">${escapeHtml(kv.jobCode)}</div>
        <div class="kv-title-text" style="${titleStyle} ${titlePosStyle}">${titleLines}</div>
        <div class="kv-desc-text" style="${descStyle} ${descPosStyle}">${descLines}</div>
        <div class="kv-footer-text" style="${footerStyle} ${footerPosStyle}">
          ${(kv.dateCompanyText != null ? kv.dateCompanyText : (kv.date + '\n' + kv.companyName)).split('\n').map(l => escapeHtml(l)).join('<br>')}
        </div>
      </div>
    `;
  }

  // 채용공고 템플릿에 따른 카드 너비 (pass_fail=698, 기본=900)
  const _headerArea = document.getElementById('kv-header-area');
  const _cardMaxW = state.template === 'pass_fail' ? '698px' : '';
  card.style.maxWidth = _cardMaxW;
  if (_headerArea) _headerArea.style.maxWidth = _cardMaxW;

  // Auto-fit title after DOM update
  requestAnimationFrame(() => autoFitTitle());

  // kv-header-area 토글 동기화
  syncKvVisibility();
  syncNonKvFieldsVisibility();

  // 편집 모드에서 새로 생성된 KV 카드 텍스트에 인라인 편집 재부착
  if (state.editMode) setupSpecialInlineEditors();
}

// ── KV Position Section Visibility ──
function updatePositionSectionVisibility() {
  const section = document.getElementById('kv-text-position-section');
  if (section) {
    section.classList.toggle('hidden', state.kv.heightMode !== 'fixed');
  }
}

// ── KV Preset Application ──
function applyKvPreset(presetKey) {
  const preset = KV_PRESETS[presetKey];
  if (!preset) return;
  state.kv.presetKey = presetKey;

  // Preserve text content, logo, and background image
  const preserve = {
    jobCode: state.kv.jobCode, title: state.kv.title, titleHtml: state.kv.titleHtml,
    orgName: state.kv.orgName, orgNameHtml: state.kv.orgNameHtml,
    description: state.kv.description,
    date: state.kv.date, companyName: state.kv.companyName, dateCompanyText: state.kv.dateCompanyText,
    logoDataUrl: state.kv.logoDataUrl, bgImageDataUrl: state.kv.bgImageDataUrl, bgImageUrl: state.kv.bgImageUrl
  };

  state.kv.templateType = preset.templateType;
  state.kv.splitLayout = preset.splitLayout || 'text-left';
  state.kv.textAlign = preset.textAlign;
  state.kv.effect = preset.effect;
  state.kv.heightMode = preset.heightMode;
  state.kv.bgColor = preset.bgColor;
  state.kv.brandColor = preset.brandColor;
  state.kv.textShadow = preset.textShadow || 'light';
  state.kv.titleAccentColor = preset.titleAccentColor || '';
  state.kv.photoContentBg = preset.photoContentBg || '#F6F6F6';
  state.kv.photoJobCodeTop = preset.photoJobCodeTop ?? 5;
  state.kv.photoRadiusTL = preset.photoRadiusTL ?? 0;
  state.kv.photoRadiusTR = preset.photoRadiusTR ?? 0;
  state.kv.photoRadiusBL = preset.photoRadiusBL ?? 0;
  state.kv.photoRadiusBR = preset.photoRadiusBR ?? 0;
  state.kv.photoImgHeight = preset.photoImgHeight ?? null;
  state.kv.photoBgSize = preset.photoBgSize ?? 100;
  state.kv.photoBgPosX = preset.photoBgPosX ?? 50;
  state.kv.photoBgPosY = preset.photoBgPosY ?? 50;
  state.kv.photoContentTopRadius = preset.photoContentTopRadius ?? 0;
  state.kv.photoContentRadiusTL = preset.photoContentRadiusTL ?? 0;
  state.kv.photoContentRadiusTR = preset.photoContentRadiusTR ?? 0;
  state.kv.photoFullBg = preset.photoFullBg ?? false;
  state.kv.hiddenFields = preset.hiddenFields || [];
  state.kv.photoMaskBL = preset.photoMaskBL ?? 0;
  state.kv.photoVerticalAlign = preset.photoVerticalAlign || 'center';
  state.kv.photoContentPadding = preset.photoContentPadding || null;
  state.kv.photoContentMinHeight = preset.photoContentMinHeight || null;
  state.kv.photoOrgNameMarginTop = preset.photoOrgNameMarginTop ?? null;
  state.kv.photoDescMargin = preset.photoDescMargin ?? null;
  state.kv.photoFooterMargin = preset.photoFooterMargin ?? null;
  const OLD_DEFAULT_TITLES = [
    DEFAULT_KV.title,
    '기업명이 들어갑니다.\n공고명이 들어갑니다.\n최대 3줄까지 가능합니다.',
    '공고제목이 들어갑니다.',
    '서류전형 합격을\n축하드립니다.',
    '채용 공고',
  ];
  if (preset.defaultTitle && OLD_DEFAULT_TITLES.includes(state.kv.title)) {
    state.kv.title = preset.defaultTitle;
    state.kv.titleHtml = escapeHtml(preset.defaultTitle).replace(/\n/g, '<br>');
  }
  state.kv.fieldStyles = JSON.parse(JSON.stringify(preset.fieldStyles));
  if (preset.textPosition) {
    state.kv.textPosition = JSON.parse(JSON.stringify(preset.textPosition));
  }

  Object.assign(state.kv, preserve);
  if (preset.defaultDescription && (preset.forceDefaultDescription || preserve.description === DEFAULT_KV.description)) {
    state.kv.description = preset.defaultDescription;
  }
  if (preset.defaultDescription2 != null && !state.kv.description2) {
    state.kv.description2 = preset.defaultDescription2;
  }
  const _applyDescEl = document.getElementById('kv-description');
  if (_applyDescEl) _applyDescEl.value = state.kv.description;
  const _applyDesc2El = document.getElementById('kv-description2');
  if (_applyDesc2El) _applyDesc2El.value = state.kv.description2 || '';
  updateKvControls();
  updatePositionSectionVisibility();
  renderKvPreview();
}

function updateKvControls() {
  // Template type
  document.querySelectorAll('[data-kv-type]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kvType === state.kv.templateType);
  });
  // Split layout
  document.querySelectorAll('[data-kv-split-layout]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kvSplitLayout === (state.kv.splitLayout || 'text-left'));
  });
  const splitGroup = document.getElementById('kv-split-layout-group');
  if (splitGroup) splitGroup.style.display = state.kv.templateType === 'split' ? '' : 'none';
  // Align
  document.querySelectorAll('[data-kv-align]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kvAlign === state.kv.textAlign);
  });
  // Effect
  document.querySelectorAll('[data-kv-effect]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kvEffect === state.kv.effect);
  });
  // Text Shadow
  document.querySelectorAll('[data-kv-shadow]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kvShadow === state.kv.textShadow);
  });
  // Height
  document.querySelectorAll('[data-kv-height]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kvHeight === state.kv.heightMode);
  });
  // Colors
  const bgC = document.getElementById('kv-bg-color');
  const bgCT = document.getElementById('kv-bg-color-text');
  const brC = document.getElementById('kv-brand-color');
  const brCT = document.getElementById('kv-brand-color-text');
  if (bgC) bgC.value = state.kv.bgColor;
  if (bgCT) bgCT.value = state.kv.bgColor;
  if (brC) brC.value = state.kv.brandColor;
  if (brCT) brCT.value = state.kv.brandColor;
  // 컬러 설정 섹션 제목 및 표시 제어
  const colorSettingsSection = document.getElementById('kv-color-settings-toggle')?.closest('.kv-collapsible');
  const colorSettingsLabel = document.getElementById('kv-color-settings-label');
  const isPhotoAnnounce03_or_04 = state.kv.presetKey === 'photoAnnounce03' || state.kv.presetKey === 'photoAnnounce04' || state.kv.presetKey === 'passFailNotice';
  // 03/04는 라운딩 섹션으로 표시 (색상 컨트롤만 숨김), 02는 "배경 및 라운딩 설정", 나머지는 "컬러 설정"
  if (colorSettingsSection) colorSettingsSection.classList.remove('hidden');
  if (colorSettingsLabel) {
    colorSettingsLabel.textContent = isPhotoAnnounce03_or_04 ? '라운딩 설정' : (state.kv.presetKey === 'photoAnnounce02' ? '배경 및 라운딩 설정' : '컬러 설정');
  }

  // photoTop 전용 배경색 컬러피커 표시/숨김
  const photoBgGroup = document.getElementById('kv-photo-content-bg-group');
  const photoBgInput = document.getElementById('kv-photo-content-bg');
  const photoBgText = document.getElementById('kv-photo-content-bg-text');
  const isPhotoTop = state.kv.templateType === 'photoTop' || state.kv.templateType === 'photoTop2' || state.kv.templateType === 'photoFull';
  const isPhotoAnnounce05 = state.kv.presetKey === 'photoAnnounce05';
  if (photoBgGroup) photoBgGroup.classList.toggle('hidden', !isPhotoTop || isPhotoAnnounce03_or_04 || isPhotoAnnounce05);
  if (photoBgInput) photoBgInput.value = state.kv.photoContentBg || '#F6F6F6';
  if (photoBgText) photoBgText.value = state.kv.photoContentBg || '#F6F6F6';
  const accentGroup = document.getElementById('kv-title-accent-color-group');
  const accentInput = document.getElementById('kv-title-accent-color');
  const accentText = document.getElementById('kv-title-accent-color-text');
  if (accentGroup) accentGroup.classList.toggle('hidden', !isPhotoTop || isPhotoAnnounce03_or_04 || isPhotoAnnounce05);
  // 실사공고05 전용: 이미지 배경 조정 컨트롤
  const photoBgAdjustGroup = document.getElementById('kv-photo-bg-adjust-group');
  if (photoBgAdjustGroup) photoBgAdjustGroup.classList.toggle('hidden', !isPhotoTop);
  if (isPhotoTop) {
    const sizeSlider = document.getElementById('kv-photo-bg-size');
    const sizeVal = document.getElementById('kv-photo-bg-size-value');
    const posXSlider = document.getElementById('kv-photo-bg-pos-x');
    const posXVal = document.getElementById('kv-photo-bg-pos-x-value');
    const posYSlider = document.getElementById('kv-photo-bg-pos-y');
    const posYVal = document.getElementById('kv-photo-bg-pos-y-value');
    if (sizeSlider) sizeSlider.value = state.kv.photoBgSize ?? 100;
    if (sizeVal) sizeVal.textContent = `${state.kv.photoBgSize ?? 100}%`;
    if (posXSlider) posXSlider.value = state.kv.photoBgPosX ?? 50;
    if (posXVal) posXVal.textContent = `${state.kv.photoBgPosX ?? 50}%`;
    if (posYSlider) posYSlider.value = state.kv.photoBgPosY ?? 50;
    if (posYVal) posYVal.textContent = `${state.kv.photoBgPosY ?? 50}%`;
  }
  if (accentInput) accentInput.value = state.kv.titleAccentColor || '#CC1111';
  if (accentText) accentText.value = state.kv.titleAccentColor || '#CC1111';
  // 기업명 에디터 동기화
  const orgNameEl = document.getElementById('kv-org-name');
  if (orgNameEl) {
    const newOrgHtml = state.kv.orgNameHtml || escapeHtml(state.kv.orgName || '').replace(/\n/g, '<br>');
    if (orgNameEl.innerHTML !== newOrgHtml) orgNameEl.innerHTML = newOrgHtml;
  }
  // 기업명 위쪽 여백 슬라이더 동기화
  const mtSlider = document.getElementById('kv-orgName-marginTop');
  const mtNum = document.getElementById('kv-orgName-marginTop-num');
  const mtVal = parseFloat(state.kv.photoOrgNameMarginTop) || (state.kv.textAlign === 'left' ? 9 : 5);
  if (mtSlider) mtSlider.value = mtVal;
  if (mtNum) mtNum.value = mtVal;
  // 날짜+기관장명 통합 textarea 동기화
  const dcTextarea = document.getElementById('kv-date-company');
  if (dcTextarea) {
    dcTextarea.value = state.kv.dateCompanyText != null
      ? state.kv.dateCompanyText
      : ((state.kv.date || '') + '\n' + (state.kv.companyName || '')).trim();
  }
  // 실사공고01: 제목 라벨 + textarea 동기화
  const titleLabel = document.getElementById('kv-title-label');
  const titleTextarea = document.getElementById('kv-title');
  if (titleLabel) {
    if (state.kv.presetKey === 'passFailNotice') titleLabel.textContent = '합격/불합격 안내 문구';
    else if (state.kv.presetKey === 'photoAnnounce04') titleLabel.textContent = '공고제목';
    else if (isPhotoTop) titleLabel.textContent = '공고제목(최대 3줄)';
    else titleLabel.textContent = '기업명 + 공고명 (최대 3줄)';
  }
  if (titleTextarea) {
    const newHtml = state.kv.titleHtml || escapeHtml(state.kv.title).replace(/\n/g, '<br>');
    if (titleTextarea.innerHTML !== newHtml) titleTextarea.innerHTML = newHtml;
  }

  // 실사공고 계열(01/02): 공고번호/회사소개 일부 컨트롤 숨김, 템플릿 설정 숨김
  const isPhotoAnnounce01 = ['photoAnnounce01','photoAnnounce02','photoAnnounce03','photoAnnounce04','photoAnnounce05','passFailNotice'].includes(state.kv.presetKey);

  // 기업명 섹션: 실사공고 계열만 표시, 나머지 프리셋은 숨김
  const orgNameSection = document.getElementById('kv-org-name-section');
  if (orgNameSection) {
    orgNameSection.style.display = isPhotoAnnounce01 ? '' : 'none';
  }

  // 템플릿 설정 섹션: 실사공고 계열만 숨김, 나머지 프리셋은 표시
  const templateSettingsSection = document.getElementById('kv-template-settings-section');
  if (templateSettingsSection) {
    templateSettingsSection.style.display = isPhotoAnnounce01 ? 'none' : '';
  }
  const jobCodeFontSizeRow = document.getElementById('kv-jobCode-fontSize-row');
  const jobCodeWeightRow = document.getElementById('kv-jobCode-weight-row');
  const jobCodeFontRow = document.getElementById('kv-jobCode-font-row');
  if (jobCodeFontSizeRow) jobCodeFontSizeRow.classList.toggle('hidden', isPhotoAnnounce01);
  if (jobCodeWeightRow) jobCodeWeightRow.classList.toggle('hidden', isPhotoAnnounce01);
  if (jobCodeFontRow) jobCodeFontRow.classList.toggle('hidden', isPhotoAnnounce01);
  const descFontSizeRow = document.getElementById('kv-description-fontSize-row');
  const descFontRow = document.getElementById('kv-description-font-row');
  if (descFontSizeRow) descFontSizeRow.classList.remove('hidden');
  if (descFontRow) descFontRow.classList.remove('hidden');
  const dateCompanyFontSizeRow = document.getElementById('kv-dateCompany-fontSize-row');
  const dateCompanyWeightRow = document.getElementById('kv-dateCompany-weight-row');
  const dateCompanyFontRow = document.getElementById('kv-dateCompany-font-row');
  if (dateCompanyFontSizeRow) dateCompanyFontSizeRow.classList.toggle('hidden', isPhotoAnnounce01);
  if (dateCompanyWeightRow) dateCompanyWeightRow.classList.toggle('hidden', isPhotoAnnounce01);
  if (dateCompanyFontRow) dateCompanyFontRow.classList.toggle('hidden', isPhotoAnnounce01);

  // hiddenFields 기반 UI 섹션 숨김 (합불 안내 등)
  const _hiddenFields = KV_PRESETS[state.kv.presetKey]?.hiddenFields || [];
  const descSection = document.getElementById('kv-description-section');
  const dcSection = document.getElementById('kv-date-company-section');
  if (descSection) descSection.style.display = _hiddenFields.includes('description') ? 'none' : '';
  if (dcSection) dcSection.style.display = _hiddenFields.includes('dateCompany') ? 'none' : '';

  // 실사공고04: 회사소개 분리 입력 레이블/rows 전환
  const isPhotoAnnounce04 = state.kv.presetKey === 'photoAnnounce04';
  const descLabel = document.getElementById('kv-description-label');
  const descTextarea = document.getElementById('kv-description');
  if (descLabel) descLabel.textContent = isPhotoAnnounce04 ? '회사 소개 (1줄 필기체)' : '회사 소개 (최대 3줄)';
  if (descTextarea) descTextarea.rows = isPhotoAnnounce04 ? 1 : 3;
  // 실사공고04 전용: kv-description2-section 표시/숨김
  const desc2Section = document.getElementById('kv-description2-section');
  if (desc2Section) desc2Section.style.display = isPhotoAnnounce04 ? '' : 'none';

  // 실사공고02/03/04: 색상 컨트롤 숨김
  const isPhotoAnnounce02 = state.kv.presetKey === 'photoAnnounce02';
  const bgColorGroup = document.getElementById('kv-bg-color-group');
  const brandColorGroup = document.getElementById('kv-brand-color-group');
  const hideColorControls = isPhotoAnnounce02 || isPhotoAnnounce03_or_04;
  if (bgColorGroup) bgColorGroup.style.display = hideColorControls ? 'none' : '';
  if (brandColorGroup) brandColorGroup.style.display = (hideColorControls || isPhotoAnnounce05) ? 'none' : '';

  // 실사공고02/03/04: 이미지 라운딩 슬라이더
  const isPhotoAnnounce03 = state.kv.presetKey === 'photoAnnounce03';
  const hasRadiusControl = isPhotoAnnounce02 || isPhotoAnnounce03 || isPhotoAnnounce04 || state.kv.presetKey === 'passFailNotice';
  const photoRadiusGroup = document.getElementById('kv-photo-radius-group');
  if (photoRadiusGroup) photoRadiusGroup.classList.toggle('hidden', !hasRadiusControl);
  const photoRadiusLabel = document.getElementById('kv-photo-radius-label');
  if (photoRadiusLabel) photoRadiusLabel.textContent = isPhotoAnnounce02 ? '이미지 모서리 라운딩' : '카드 모서리 라운딩';
  if (hasRadiusControl) {
    [['tl', 'TL'], ['tr', 'TR'], ['bl', 'BL'], ['br', 'BR']].forEach(([id, key]) => {
      const slider = document.getElementById(`kv-radius-${id}`);
      const label = document.getElementById(`kv-radius-${id}-value`);
      const v = state.kv[`photoRadius${key}`] ?? 0;
      if (slider) slider.value = v;
      if (label) label.textContent = `${v}px`;
    });
  }

  // 카드 배경색 동기화
  const bgcPicker = document.getElementById('kv-card-bgcolor');
  const bgcText = document.getElementById('kv-card-bgcolor-text');
  if (bgcPicker) bgcPicker.value = state.kv.bgColor || '#0a0f1e';
  if (bgcText) bgcText.value = state.kv.bgColor || '#0a0f1e';

  // 공고번호 상단 위치 슬라이더 (photoTop 전용)
  const jobCodeTopGroup = document.getElementById('kv-job-code-top-group');
  const jobCodeTopSlider = document.getElementById('kv-job-code-top-slider');
  const jobCodeTopValue = document.getElementById('kv-job-code-top-value');
  if (jobCodeTopGroup) jobCodeTopGroup.classList.toggle('hidden', !isPhotoTop);
  if (jobCodeTopSlider) jobCodeTopSlider.value = state.kv.photoJobCodeTop ?? 5;
  if (jobCodeTopValue) jobCodeTopValue.textContent = `${state.kv.photoJobCodeTop ?? 5}%`;

  // 템플릿 설정 내 그룹 표시/숨김 (photoTop: 텍스트 정렬만 표시)
  ['kv-template-type-group', 'kv-split-layout-group', 'kv-effect-group', 'kv-shadow-group', 'kv-height-group'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', isPhotoTop);
  });

  // photoTop 선택 시 하단 접이식 섹션 모두 펼치기
  if (isPhotoTop) {
    [
      'kv-text-inputs-body',
      'kv-template-settings-body',
      'kv-color-settings-body',
      'kv-logo-body',
      'kv-company-search-body',
      'kv-bg-settings-body',
      'kv-img-search-body',
    ].forEach(id => {
      const body = document.getElementById(id);
      const toggle = body?.previousElementSibling;
      if (body) body.classList.remove('hidden');
      if (toggle) toggle.classList.add('open');
    });
  }

  // Field styles (sliders, color pickers, bold checkboxes)
  for (const [field, styles] of Object.entries(state.kv.fieldStyles)) {
    document.querySelectorAll(`[data-field="${field}"][data-prop="fontSize"]`).forEach(el => el.value = styles.fontSize);
    document.querySelectorAll(`[data-field="${field}"][data-prop="color"]`).forEach(el => el.value = styles.color);
    document.querySelectorAll(`[data-field="${field}"][data-prop="bold"]`).forEach(el => el.checked = styles.bold);
    const fontSel = document.querySelector(`.kv-font-select[data-field="${field}"]`);
    if (fontSel && styles.fontFamily) fontSel.value = styles.fontFamily;
    const weightSel = document.querySelector(`.kv-weight-select[data-field="${field}"]`);
    if (weightSel && styles.fontWeight != null) weightSel.value = styles.fontWeight;
    const fieldAlign = styles.align || 'left';
    document.querySelectorAll(`.kv-field-align-btn[data-field="${field}"]`).forEach(b => b.classList.toggle('active', b.dataset.align === fieldAlign));
  }
  // Position controls
  if (state.kv.textPosition) {
    for (const [field, pos] of Object.entries(state.kv.textPosition)) {
      for (const [axis, val] of Object.entries(pos)) {
        document.querySelectorAll(`[data-pos="${field}"][data-axis="${axis}"]`).forEach(el => el.value = val);
      }
    }
  }
}

// ── Auto-fit Title ──
function autoFitTitle() {
  const autoFitCb = document.getElementById('kv-title-autofit');
  if (autoFitCb && !autoFitCb.checked) return;

  const card = document.getElementById('kv-preview-card');
  const titleEl = card?.querySelector('.kv-title-text');
  if (!titleEl || !card) return;

  // 사용자가 설정한 폰트 크기를 시작점으로 사용 (덮어쓰지 않음)
  let fs = state.kv.fieldStyles?.title?.fontSize || 50;
  titleEl.style.fontSize = `${fs}px`;

  // 넘치면 축소 (카드 높이의 40% 이내)
  const cardHeight = card.offsetHeight;
  const maxTitleH = cardHeight * 0.4;
  const minFs = 18;

  while (fs > minFs && titleEl.scrollHeight > maxTitleH) {
    fs -= 2;
    titleEl.style.fontSize = `${fs}px`;
  }

  if (fs !== state.kv.fieldStyles.title.fontSize) {
    state.kv.fieldStyles.title.fontSize = fs;
    document.querySelectorAll('[data-field="title"][data-prop="fontSize"]').forEach(el => el.value = fs);
  }
}

// ── Smart Preset Detection ──
function detectBestPreset() {
  const src = (elements.sourceEditor?.innerText || '').toLowerCase();
  const company = (state.kv.companyName || '').toLowerCase();

  if (src.includes('공공기관') || src.includes('공단') || src.includes('정부') || src.includes('공사') || src.includes('재단법인') || src.includes('지방자치')) return 'government';
  if (src.includes('스타트업') || src.includes('벤처') || src.includes('시리즈') || src.includes('seed') || src.includes('투자')) return 'startupVibe';
  if (src.includes('디자인') || src.includes('크리에이티브') || src.includes('광고') || src.includes('미디어') || src.includes('콘텐츠')) return 'creative';
  if (company.includes('(주)') || company.includes('㈜') || company.includes('주식회사') || company.includes('코퍼레이션')) return 'cleanCorporate';
  return 'photoAnnounce01';
}

// ── Smart Korean Text Wrapping ──
function smartWrapKorean(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';

  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (test.length > maxLen && cur) {
      lines.push(cur);
      cur = word;
      if (lines.length >= 2) { lines.push(cur); break; }
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < 3) lines.push(cur);
  return lines.slice(0, 3).join('\n');
}

async function downloadKvImage(format = 'png', scale = 2) {
  const card = document.getElementById('kv-preview-card');
  if (!card) return;

  const btn = document.getElementById('btn-kv-download');
  btn.disabled = true;
  const origText = btn.innerHTML;
  const scaleLabel = scale >= 4 ? '4x 고화질' : '2x';
  btn.innerHTML = `<span class="loading"></span> ${scaleLabel} 생성 중...`;

  const restore = await prepareCardForCapture(card);
  try {
    const canvas = await html2canvas(card, {
      scale: scale,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });
    const link = document.createElement('a');
    const jobCodeClean = (state.kv.jobCode || 'preview').replace(/[^\w가-힣]/g, '_');
    const filename = `inckv-${jobCodeClean}-${scale}x`;

    if (format === 'jpg') {
      link.download = `${filename}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.92);
    } else {
      link.download = `${filename}.png`;
      link.href = canvas.toDataURL('image/png');
    }
    link.click();
  } catch (err) {
    console.error('Download failed:', err);
    showToast('다운로드에 실패했습니다: ' + err.message);
  } finally {
    restore();
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

function downloadKvHtml() {
  const card = document.getElementById('kv-preview-card');
  if (!card) return;

  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>키비주얼 - ${escapeHtml(state.kv.jobCode)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; background: #f3f4f6; font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif; }
${getKvCardStyles()}
</style>
</head>
<body>
${card.outerHTML}
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const link = document.createElement('a');
  const jobCodeClean = (state.kv.jobCode || 'preview').replace(/[^\w가-힣]/g, '_');
  link.download = `inckv-${jobCodeClean}.html`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

// ── Preview 전체용 OG 크롭 (KV 사용 안 하는 공고용, 600×315) ──
let _previewCropState = null;

function startPreviewOgCrop() {
  const preview = document.getElementById('template-preview');
  const overlay = document.getElementById('preview-crop-overlay');
  const cropBox = document.getElementById('preview-crop-box');
  const actions = document.getElementById('preview-crop-actions');
  const btnStart = document.getElementById('btn-preview-og-crop');
  if (!preview || !overlay || !cropBox || !actions) return;

  // 오버레이를 뷰포트에 맞춰 덮되, 미리보기 영역 내부 스크롤 기준으로 절대 좌표.
  const rect = preview.getBoundingClientRect();
  overlay.style.width = preview.scrollWidth + 'px';
  overlay.style.height = preview.scrollHeight + 'px';
  overlay.classList.remove('hidden');
  actions.classList.remove('hidden');
  actions.style.display = 'flex';
  if (btnStart) btnStart.classList.add('hidden');

  const RATIO = 600 / 315;
  const containerW = preview.scrollWidth;
  const containerH = preview.scrollHeight;
  let bw = Math.min(Math.round(containerW * 0.85), 600);
  let bh = Math.round(bw / RATIO);
  if (bh > containerH * 0.85) {
    bh = Math.round(containerH * 0.85);
    bw = Math.round(bh * RATIO);
  }
  let bx = Math.max(0, Math.round((containerW - bw) / 2));
  let by = Math.max(0, Math.round(preview.scrollTop + 20));

  cropBox.style.width = bw + 'px';
  cropBox.style.height = bh + 'px';
  cropBox.style.left = bx + 'px';
  cropBox.style.top = by + 'px';

  let dragging = false;
  let startX, startY, startBx, startBy;
  function onMouseDown(e) {
    e.preventDefault();
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startBx = bx; startBy = by;
  }
  function onMouseMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    bx = Math.max(0, Math.min(containerW - bw, startBx + dx));
    by = Math.max(0, Math.min(containerH - bh, startBy + dy));
    cropBox.style.left = bx + 'px';
    cropBox.style.top = by + 'px';
  }
  function onMouseUp() { dragging = false; }

  cropBox.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  _previewCropState = {
    bx: () => bx, by: () => by, bw: () => bw, bh: () => bh,
    containerW: () => containerW, containerH: () => containerH,
    cleanup() {
      cropBox.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  };
}

function cancelPreviewOgCrop() {
  if (_previewCropState) { _previewCropState.cleanup(); _previewCropState = null; }
  document.getElementById('preview-crop-overlay')?.classList.add('hidden');
  const actions = document.getElementById('preview-crop-actions');
  if (actions) { actions.classList.add('hidden'); actions.style.display = 'none'; }
  document.getElementById('btn-preview-og-crop')?.classList.remove('hidden');
}

async function confirmPreviewOgCrop() {
  if (!_previewCropState) return;
  const btn = document.getElementById('btn-preview-crop-confirm');
  const origText = btn?.textContent || '저장';
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }

  try {
    // 1) Playwright 서버로 전체 미리보기 PNG 요청
    const srcRaw = state.originalSource?.raw || '';
    const useSrcRaw = srcRaw && /id=["']?templwrap_v3/i.test(srcRaw);
    let htmlForCapture = useSrcRaw
      ? srcRaw
      : ((typeof generateFullHtml === 'function') ? generateFullHtml() : document.getElementById('template-preview').outerHTML);
    if (useSrcRaw && typeof applyPostTypeProcessing === 'function') {
      try { htmlForCapture = applyPostTypeProcessing(htmlForCapture); } catch (_) {}
    }
    const resp = await fetch('/api/render-full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: htmlForCapture, width: 900, scale: 1, format: 'png' }),
      signal: AbortSignal.timeout(120000),
    });
    if (!resp.ok) throw new Error('서버 캡처 실패 status ' + resp.status);
    const blob = await resp.blob();
    const imgUrl = URL.createObjectURL(blob);
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('캡처 이미지 로드 실패'));
      im.src = imgUrl;
    });
    URL.revokeObjectURL(imgUrl);

    // 2) 클라이언트 좌표 → 캡처 이미지 좌표 변환
    // 서버 렌더는 width=900 → 이미지 실픽셀 폭 ≈ 900 (템플릿이 900px 폭일 때)
    // 미리보기 패널(template-preview)은 flex-1이라 폭이 가변이지만,
    // 내부 콘텐츠(templwrap_v3 / kv-preview-card)는 900px 고정. 그래서
    // 크롭 좌표(bx,by)는 콘텐츠 좌상단 기준으로 오프셋 보정 후 이미지 배율로 변환.
    const bx = _previewCropState.bx();
    const by = _previewCropState.by();
    const bw = _previewCropState.bw();
    const bh = _previewCropState.bh();
    const previewEl = document.getElementById('template-preview');
    const contentEl = previewEl?.querySelector('#templwrap_v3, #templwrap, #kv-preview-card')
      || Array.from(previewEl?.children || []).find(c => c.id !== 'floating-toolbar' && c.id !== 'preview-crop-overlay' && !c.classList?.contains('hidden'))
      || previewEl;
    const cRect = contentEl.getBoundingClientRect();
    const pRect = previewEl.getBoundingClientRect();
    const contentLeft = (cRect.left - pRect.left) + previewEl.scrollLeft;
    const contentTop  = (cRect.top  - pRect.top)  + previewEl.scrollTop;
    const contentW = contentEl.offsetWidth || cRect.width;
    const scaleX = img.naturalWidth / contentW;
    const scaleY = scaleX;
    const sx = Math.round((bx - contentLeft) * scaleX);
    const sy = Math.round((by - contentTop)  * scaleY);
    const sw = Math.round(bw * scaleX);
    const sh = Math.round(bh * scaleY);

    // 3) Canvas 크롭 → 600×315
    // build 418: 좌표 클램프 + 흰 배경 선 채움 (투명 영역이 검게 보이던 문제 방지)
    const imgW = img.naturalWidth, imgH = img.naturalHeight;
    const sxC = Math.max(0, Math.min(imgW - 1, sx));
    const syC = Math.max(0, Math.min(imgH - 1, sy));
    const swC = Math.max(1, Math.min(imgW - sxC, sw));
    const shC = Math.max(1, Math.min(imgH - syC, sh));
    console.log('[OG crop] img=', imgW, 'x', imgH, 'contentW=', contentW, 'scale=', scaleX.toFixed(3),
                'raw crop=', sx, sy, sw, sh, 'clamped=', sxC, syC, swC, shC);
    const out = document.createElement('canvas');
    out.width = 600; out.height = 315;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 315);
    ctx.drawImage(img, sxC, syC, swC, shC, 0, 0, 600, 315);

    const jobCodeClean = (state.kv?.jobCode || state.jobNumber || 'preview').replace(/[^\w가-힣]/g, '_');
    // canvas → blob으로 다운로드 (dataURL는 큰 이미지에서 브라우저 거부 가능)
    await new Promise((resolve) => {
      out.toBlob((b) => {
        if (!b) { resolve(); return; }
        const url = URL.createObjectURL(b);
        const link = document.createElement('a');
        link.download = `${jobCodeClean}_600315.png`;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve();
      }, 'image/png');
    });
  } catch (err) {
    console.error('Preview OG crop failed:', err);
    showToast('OG 크롭 저장에 실패했습니다: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = origText; }
    cancelPreviewOgCrop();
  }
}

// ── KV OG 크롭 (600×315) ──
let _cropState = null;

function startKvCrop() {
  const card = document.getElementById('kv-preview-card');
  const overlay = document.getElementById('kv-crop-overlay');
  const cropBox = document.getElementById('kv-crop-box');
  if (!card || !overlay || !cropBox) return;

  // 카드 영역에 overlay 맞추기
  overlay.style.width = card.offsetWidth + 'px';
  overlay.style.height = card.offsetHeight + 'px';
  overlay.classList.remove('hidden');

  document.getElementById('btn-kv-crop-start').classList.add('hidden');
  document.getElementById('kv-crop-actions').classList.remove('hidden');

  // 초기 크롭박스: 카드 너비의 85%, 600:315 비율 유지, 가운데 배치
  const RATIO = 600 / 315;
  const cardW = card.offsetWidth;
  const cardH = card.offsetHeight;
  let bw = Math.round(cardW * 0.85);
  let bh = Math.round(bw / RATIO);
  if (bh > cardH * 0.85) {
    bh = Math.round(cardH * 0.85);
    bw = Math.round(bh * RATIO);
  }
  let bx = Math.round((cardW - bw) / 2);
  let by = Math.round((cardH - bh) / 2);

  cropBox.style.width = bw + 'px';
  cropBox.style.height = bh + 'px';
  cropBox.style.left = bx + 'px';
  cropBox.style.top = by + 'px';

  // 드래그 이벤트
  let dragging = false;
  let startX, startY, startBx, startBy;

  function onMouseDown(e) {
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startBx = bx;
    startBy = by;
  }
  function onMouseMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    bx = Math.max(0, Math.min(cardW - bw, startBx + dx));
    by = Math.max(0, Math.min(cardH - bh, startBy + dy));
    cropBox.style.left = bx + 'px';
    cropBox.style.top = by + 'px';
  }
  function onMouseUp() { dragging = false; }

  cropBox.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  _cropState = {
    bx: () => bx, by: () => by, bw: () => bw, bh: () => bh,
    cleanup() {
      cropBox.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  };
}

function cancelKvCrop() {
  if (_cropState) { _cropState.cleanup(); _cropState = null; }
  document.getElementById('kv-crop-overlay')?.classList.add('hidden');
  document.getElementById('btn-kv-crop-start')?.classList.remove('hidden');
  document.getElementById('kv-crop-actions')?.classList.add('hidden');
}

async function confirmKvCrop() {
  if (!_cropState) return;
  const card = document.getElementById('kv-preview-card');
  if (!card) return;

  const btn = document.getElementById('btn-kv-crop-confirm');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '저장 중...';

  try {
    const renderScale = 2;
    // 캡처 전 오버레이 완전 제거 후 렌더 대기
    const overlay = document.getElementById('kv-crop-overlay');
    if (overlay) overlay.style.display = 'none';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // 이미지 CORS 변환 + html2canvas workaround 적용
    const restoreImages = await prepareImagesForCapture(card);
    const restoreH2cWorkarounds = await applyHtml2canvasWorkarounds(card);
    let canvas;
    try {
      canvas = await html2canvas(card, {
        scale: renderScale,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });
    } finally {
      if (restoreH2cWorkarounds) restoreH2cWorkarounds();
      restoreImages();
    }
    if (overlay) overlay.style.display = '';

    const bx = _cropState.bx();
    const by = _cropState.by();
    const bw = _cropState.bw();
    const bh = _cropState.bh();

    // 렌더 스케일 적용
    const sx = Math.round(bx * renderScale);
    const sy = Math.round(by * renderScale);
    const sw = Math.round(bw * renderScale);
    const sh = Math.round(bh * renderScale);

    const out = document.createElement('canvas');
    out.width = 600;
    out.height = 315;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, 600, 315);

    const jobCodeClean = (state.kv.jobCode || 'preview').replace(/[^\w가-힣]/g, '_');
    const link = document.createElement('a');
    link.download = `${jobCodeClean}_600315.png`;
    link.href = out.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Crop download failed:', err);
    showToast('크롭 저장에 실패했습니다: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
    cancelKvCrop();
  }
}

// ── KV 서버 사이드 렌더링 (Playwright) ──
/**
 * convert-server의 /api/render-kv 엔드포인트를 사용하여
 * 서버에서 Playwright(Chromium)로 KV를 PNG/JPEG로 렌더링
 * @param {'png'|'jpeg'} format
 * @param {number} scale - 해상도 배율 (1~4)
 */
async function downloadKvServerRender(format = 'png', scale = 2) {
  const card = document.getElementById('kv-preview-card');
  if (!card) return;

  const btn = document.getElementById('btn-kv-download');
  btn.disabled = true;
  const origText = btn.innerHTML;
  btn.innerHTML = `<span class="loading"></span> 서버 렌더링 중...`;

  try {
    // KV 카드 HTML (독립 실행 가능한 완전한 문서)
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: transparent; }
${getKvCardStyles()}
</style>
</head>
<body>
${card.outerHTML}
</body>
</html>`;

    const kvCard = card.querySelector('.kv-card') || card;
    const width = Math.round(kvCard.offsetWidth || 1200);
    const height = Math.round(kvCard.offsetHeight || 675);

    const resp = await fetch(`${CONVERT_SERVER_URL}/api/render-kv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: htmlContent, width, height, scale, format }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `서버 오류 (${resp.status})` }));
      throw new Error(err.error || `서버 오류 (${resp.status})`);
    }

    const blob = await resp.blob();
    const link = document.createElement('a');
    const jobCodeClean = (state.kv.jobCode || 'preview').replace(/[^\w가-힣]/g, '_');
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    link.download = `inckv-server-${jobCodeClean}-${scale}x.${ext}`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    showToast(`서버 렌더링 완료 (${scale}x)`);
  } catch (err) {
    console.error('[Server Render]', err);
    showToast('서버 렌더링 실패: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
  }
}

// ── KV 추가 액션: 클립보드 이미지 복사 ──
async function copyKvToClipboard() {
  const card = document.getElementById('kv-preview-card');
  if (!card) return;

  const btn = document.getElementById('btn-kv-copy-image');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span>';

  const restore = await prepareCardForCapture(card);
  try {
    const canvas = await html2canvas(card, {
      scale: 1,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });
    restore();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    btn.classList.add('copied');
    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> 복사됨`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = origHtml;
    }, 1500);
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    showToast('클립보드 복사에 실패했습니다: ' + err.message);
    btn.innerHTML = origHtml;
  } finally {
    btn.disabled = false;
  }
}

// ── KV 추가 액션: 새 창 미리보기 ──
function openKvPreviewPopup() {
  const card = document.getElementById('kv-preview-card');
  if (!card) return;

  const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>키비주얼 미리보기 - ${escapeHtml(state.kv.jobCode || '')}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; background: #f3f4f6; font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif; }
${getKvCardStyles()}
</style>
</head>
<body>
${card.outerHTML}
</body>
</html>`;

  const popup = window.open('', '_blank', 'width=860,height=620,scrollbars=yes');
  if (popup) {
    popup.document.write(htmlContent);
    popup.document.close();
  } else {
    showToast('팝업이 차단되었습니다. 브라우저에서 팝업을 허용해주세요.');
  }
}

// ── KV 추가 액션: 자동 채우기 (강제) ──
function forceAutoFillKv() {
  const sourceText = (elements.sourceEditor.innerText || '').trim();
  if (!sourceText || sourceText.length < 10) {
    addMessage('assistant', '키비주얼을 자동 채우려면 원문이 필요합니다. 채용공고 원문을 먼저 입력해주세요.');
    return;
  }

  const extracted = parseJobPostContent(sourceText);
  if (!extracted || Object.keys(extracted).length === 0) {
    addMessage('assistant', '원문에서 채용 정보를 찾지 못했습니다. 기업명, 공고명, 마감일 등이 포함된 원문인지 확인해주세요.');
    return;
  }

  let changed = false;
  if (extracted.jobCode) { state.kv.jobCode = extracted.jobCode; document.getElementById('kv-job-code').value = extracted.jobCode; changed = true; }
  if (extracted.title) { state.kv.title = extracted.title; const _te1 = document.getElementById('kv-title'); if (_te1) { _te1.innerHTML = escapeHtml(extracted.title).replace(/\n/g, '<br>'); state.kv.titleHtml = _te1.innerHTML; } changed = true; }
  if (extracted.description) { state.kv.description = extracted.description; document.getElementById('kv-description').value = extracted.description; changed = true; }
  if (extracted.companyName) { state.kv.companyName = extracted.companyName; changed = true; }
  if (extracted.date) { state.kv.date = extracted.date; changed = true; }
  if (extracted.companyName || extracted.date) {
    state.kv.dateCompanyText = (state.kv.date || '') + '\n' + (state.kv.companyName || '');
    const _dcEl2 = document.getElementById('kv-date-company');
    if (_dcEl2) _dcEl2.value = state.kv.dateCompanyText;
  }
  if (!extracted.jobCode && state.jobNumber) { state.kv.jobCode = `공고 제${state.jobNumber}호`; document.getElementById('kv-job-code').value = state.kv.jobCode; changed = true; }

  // 배경 이미지도 강제 갱신
  const autoBg = pickBgImageByKeywords(sourceText);
  if (autoBg) {
    state.kv.bgImageUrl = autoBg;
    const bgInput = document.getElementById('kv-bg-url');
    if (bgInput) bgInput.value = autoBg;
    changed = true;
  }

  if (changed) {
    renderKvPreview();
    const btn = document.getElementById('btn-kv-autofill');
    const origHtml = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> 완료`;
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = origHtml; }, 1500);
  }
}

/** KV에서 사용 중인 폰트에 필요한 <link>/<style> 태그 문자열 반환 */
function getKvFontLinks() {
  if (!state.kv?.fieldStyles) return '';

  const usedFonts = new Set(
    Object.values(state.kv.fieldStyles).map(s => s.fontFamily).filter(Boolean)
  );

  const googleFamilies = [];
  const cdnLinks = [];
  const fontFaces = [];

  const GOOGLE_FONT_MAP = {
    'Noto Sans KR':     'Noto+Sans+KR:wght@400;700',
    'Nanum Gothic':     'Nanum+Gothic:wght@400;700',
    'Nanum Myeongjo':   'Nanum+Myeongjo:wght@400;700',
    'Nanum Pen Script': 'Nanum+Pen+Script',
    'Black Han Sans':   'Black+Han+Sans',
  };

  const CUSTOM_FONT_FACE_MAP = {
    'GMarketSans': `
@font-face{font-family:'GMarketSans';src:url('https://i.incru.it/ui/static/font/builder/GmarketSansLight.woff') format('woff');font-weight:300;font-display:swap}
@font-face{font-family:'GMarketSans';src:url('https://i.incru.it/ui/static/font/builder/GmarketSansMedium.woff') format('woff');font-weight:500;font-display:swap}
@font-face{font-family:'GMarketSans';src:url('https://i.incru.it/ui/static/font/builder/GmarketSansBold.woff') format('woff');font-weight:700;font-display:swap}`,
    'Paperozi': `
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-1Thin.woff2') format('woff2');font-weight:100;font-display:swap}
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-2ExtraLight.woff2') format('woff2');font-weight:200;font-display:swap}
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-3Light.woff2') format('woff2');font-weight:300;font-display:swap}
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-4Regular.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-5Medium.woff2') format('woff2');font-weight:500;font-display:swap}
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-6SemiBold.woff2') format('woff2');font-weight:600;font-display:swap}
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-7Bold.woff2') format('woff2');font-weight:700;font-display:swap}
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-8ExtraBold.woff2') format('woff2');font-weight:800;font-display:swap}
@font-face{font-family:'Paperozi';src:url('https://i.incru.it/ui/static/font/builder/paperlogy/Paperlogy-9Black.woff2') format('woff2');font-weight:900;font-display:swap}`,
    'YeogiOttaeJalnan': `@font-face{font-family:'YeogiOttaeJalnan';src:url('https://i.incru.it/ui/static/font/builder/JalnanOTF00.woff') format('woff');font-weight:normal;font-display:swap}`,
    'YeogiOttaeJalnanGothic': `@font-face{font-family:'YeogiOttaeJalnanGothic';src:url('https://i.incru.it/ui/static/font/builder/JalnanGothic.woff') format('woff');font-weight:normal;font-display:swap}`,
    'Aggravo': `
@font-face{font-family:'Aggravo';src:url('https://i.incru.it/ui/static/font/builder/SBAggroL.woff') format('woff');font-weight:300;font-display:swap}
@font-face{font-family:'Aggravo';src:url('https://i.incru.it/ui/static/font/builder/SBAggroM.woff') format('woff');font-weight:500;font-display:swap}
@font-face{font-family:'Aggravo';src:url('https://i.incru.it/ui/static/font/builder/SBAggroB.woff') format('woff');font-weight:700;font-display:swap}`,
    'SchoolSafetyNotification': `
@font-face{font-family:'SchoolSafetyNotification';src:url('https://i.incru.it/ui/static/font/builder/HakgyoansimAllimjangTTF-R.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'SchoolSafetyNotification';src:url('https://i.incru.it/ui/static/font/builder/HakgyoansimAllimjangTTF-B.woff2') format('woff2');font-weight:700;font-display:swap}`,
    'GangwonEducationTteontteon': `@font-face{font-family:'GangwonEducationTteontteon';src:url('https://i.incru.it/ui/static/font/builder/GangwonEduPowerExtraBoldA.woff') format('woff');font-weight:normal;font-display:swap}`,
    'KotraBold': `@font-face{font-family:'KotraBold';src:url('https://i.incru.it/ui/static/font/builder/KOTRA_BOLD-Bold.woff') format('woff');font-weight:normal;font-display:swap}`,
  };

  for (const font of usedFonts) {
    if (font === 'Pretendard Variable') {
      continue; // 등록 사이트에 이미 적용되어 있으므로 별도 추가 불필요
    } else if (GOOGLE_FONT_MAP[font]) {
      googleFamilies.push(GOOGLE_FONT_MAP[font]);
    } else if (CUSTOM_FONT_FACE_MAP[font]) {
      fontFaces.push(CUSTOM_FONT_FACE_MAP[font]);
    }
  }

  let result = '';
  if (cdnLinks.length) result += cdnLinks.join('\n') + '\n';
  if (googleFamilies.length) {
    result += '<link rel="preconnect" href="https://fonts.googleapis.com">\n';
    result += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n';
    result += `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${googleFamilies.join('&family=')}&display=swap">\n`;
  }
  if (fontFaces.length) {
    result += `<style>${fontFaces.join('\n')}\n</style>\n`;
  }
  return result;
}

function getKvCardStyles() {
  // Return CSS needed for standalone KV card rendering (minified, single line).
  // Exclude editor/toolbar UI rules that don't belong in exported HTML.
  const EDITOR_RULES = [
    'kv-color-toolbar', 'kv-toolbar-row', 'kv-toolbar-divider',
    'kv-color-toolbar-label', 'kv-color-swatch', 'kv-color-clear-btn',
    'kv-grad-arrow', 'kv-grad-direction', 'kv-rich-editor',
    'kv-preset-card', 'kv-chat', 'kv-search', 'kv-image-grid',
    'kv-company-results', 'kv-field-settings', 'kv-btn-group',
    'kv-option-btn', 'kv-collapsible', 'kv-toggle', 'kv-crop',
    'kv-og-crop', 'kv-ai-', 'kv-img-upload', 'kv-download',
    'kv-action-btn', 'kv-preset-clean', 'kv-header-area',
    'kv-section-title', 'kv-tab-', 'kv-panel-', 'kv-range',
    'kv-label-row', 'kv-gradient-preview', 'kv-color-dot',
    'kv-align-btn', 'kv-size-input', 'kv-font-select',
    'kv-sidebar', 'kv-upload', 'kv-company', 'kv-placeholder',
    'kv-editor'
  ];
  const styles = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const sel = rule.selectorText || '';
        if (sel.includes('.kv-') && !EDITOR_RULES.some(p => sel.includes(p))) {
          styles.push(rule.cssText);
        }
      }
    } catch (e) { /* cross-origin */ }
  }
  // Minify: 공백/줄바꿈 압축하여 한 줄로
  return styles.join(' ').replace(/\s+/g, ' ').replace(/\s*([{};:,>~+])\s*/g, '$1').trim();
}

// ============================================
// 기업정보 검색 에이전트 (Incruit Company Search)
// ============================================

const PROXY_BASE = '/proxy/?url=';

/**
 * 인크루트 기업 검색 — 검색 결과 페이지를 스크래핑하여 기업 목록 반환
 * @param {string} keyword - 검색 키워드 (기업명)
 * @returns {Promise<Array<{id: string, name: string, logoUrl: string, meta: string}>>}
 */
async function searchIncruitCompany(keyword) {
  const resultsDiv = document.getElementById('kv-company-results');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '<div class="kv-company-loading">검색 중...</div>';

  try {
    // CORS 프록시 헬스체크
    const health = await fetch(PROXY_HEALTH_URL, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (!health?.ok) {
      resultsDiv.innerHTML = '<div class="kv-company-msg">CORS 프록시가 필요합니다. <code>python3 cors-proxy.py</code>를 실행해주세요.</div>';
      return [];
    }

    // 인크루트 채용 검색 페이지에서 기업 정보 추출
    const searchUrl = `https://job.incruit.com/jobdb_list/searchjob.asp?col=job_all&il=y&kw=${encodeURIComponent(keyword)}`;
    const resp = await fetch(PROXY_BASE + encodeURIComponent(searchUrl), { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 검색 결과에서 기업 링크 추출 (company/{id}/ 패턴)
    const companyMap = new Map();
    const links = doc.querySelectorAll('a[href*="/company/"]');
    links.forEach(a => {
      const match = a.href.match(/\/company\/(\d+)/);
      if (!match) return;
      const id = match[1];
      if (companyMap.has(id)) return;

      // 기업명 추출 (링크 텍스트 또는 이미지 alt)
      let name = a.textContent.trim();
      if (!name || name.length < 2) {
        const img = a.querySelector('img');
        name = img?.alt?.trim() || '';
      }
      if (!name || name.length < 2) return;

      // 로고 이미지 탐색
      let logoUrl = '';
      const img = a.querySelector('img') || a.closest('li,tr,div')?.querySelector('img');
      if (img?.src) {
        let src = img.getAttribute('src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.includes('incru.it') || src.includes('incruit.com')) logoUrl = src;
      }

      companyMap.set(id, { id, name, logoUrl, meta: '' });
    });

    const companies = Array.from(companyMap.values()).slice(0, 10);

    if (companies.length === 0) {
      resultsDiv.innerHTML = `<div class="kv-company-msg">'${keyword}'에 해당하는 기업을 찾지 못했습니다.</div>`;
      return [];
    }

    renderCompanyResults(companies);
    return companies;
  } catch (e) {
    console.error('[CompanySearch]', e);
    resultsDiv.innerHTML = '<div class="kv-company-msg">기업정보를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.</div>';
    return [];
  }
}

/**
 * 인크루트 기업 상세 페이지에서 정보 추출
 * @param {string} companyId
 * @returns {Promise<{name, logoUrl, industry, size, ceo, address, website}|null>}
 */
async function fetchCompanyDetail(companyId) {
  try {
    const url = `https://www.incruit.com/company/${companyId}/`;
    const resp = await fetch(PROXY_BASE + encodeURIComponent(url), { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;

    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 기업명: 페이지 타이틀에서 추출 ("2026년 XX 채용 기업정보 | 인크루트")
    const title = doc.querySelector('title')?.textContent || '';
    const nameMatch = title.match(/(?:\d{4}년\s+)?(.+?)\s+채용/);
    const name = nameMatch?.[1]?.trim() || '';

    // 로고 이미지
    let logoUrl = '';
    const logoImg = doc.querySelector('img[src*="incru.it"], img[src*="compphoto"]');
    if (logoImg) {
      let src = logoImg.getAttribute('src') || '';
      if (src.startsWith('//')) src = 'https:' + src;
      logoUrl = src;
    }

    // 본문 텍스트에서 정보 추출
    const bodyText = doc.body?.textContent || '';

    // 업종
    const industryMatch = bodyText.match(/업종[:\s]*([^\n]{2,20})/);
    const industry = industryMatch?.[1]?.trim() || '';

    // 기업규모 (직원수)
    const sizeMatch = bodyText.match(/(?:직원|사원|인원)[^\d]*(\d[\d,]*)\s*명/);
    const size = sizeMatch ? sizeMatch[1].replace(/,/g, '') + '명' : '';

    // 대표자
    const ceoMatch = bodyText.match(/대표(?:이사|자)?[:\s]*([가-힣]{2,5})/);
    const ceo = ceoMatch?.[1]?.trim() || '';

    // 주소
    const addrMatch = bodyText.match(/((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{5,50})/);
    const address = addrMatch?.[1]?.trim() || '';

    return { name, logoUrl, industry, size, ceo, address };
  } catch (e) {
    console.error('[CompanyDetail]', e);
    return null;
  }
}

/**
 * 기업 검색 결과 카드 렌더링
 */
function renderCompanyResults(companies) {
  const resultsDiv = document.getElementById('kv-company-results');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '';

  companies.forEach(company => {
    const card = document.createElement('div');
    card.className = 'kv-company-card';
    card.innerHTML = `
      ${company.logoUrl
        ? `<img class="kv-company-logo" src="${company.logoUrl}" alt="" onerror="this.style.display='none'">`
        : `<div class="kv-company-logo" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:16px;font-weight:700;">${company.name.charAt(0)}</div>`
      }
      <div class="kv-company-info">
        <div class="kv-company-name">${company.name}</div>
        ${company.meta ? `<div class="kv-company-meta">${company.meta}</div>` : '<div class="kv-company-meta">클릭하여 상세정보 조회</div>'}
      </div>
    `;

    card.addEventListener('click', async () => {
      // 선택 표시
      resultsDiv.querySelectorAll('.kv-company-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      // 메타 표시 업데이트
      const metaEl = card.querySelector('.kv-company-meta');
      metaEl.textContent = '상세정보 조회 중...';

      // 상세 정보 fetch
      const detail = await fetchCompanyDetail(company.id);
      if (detail) {
        const metaParts = [detail.industry, detail.size, detail.ceo].filter(Boolean);
        metaEl.textContent = metaParts.join(' · ') || '정보 없음';
        applyCompanyToKv({ ...company, ...detail });
      } else {
        metaEl.textContent = '상세정보 조회 실패';
        // 기본 정보로라도 적용
        applyCompanyToKv(company);
      }
    });

    resultsDiv.appendChild(card);
  });
}

/**
 * 선택된 기업 정보를 KV에 적용
 */
async function applyCompanyToKv(company) {
  // 1. 기업명 적용
  if (company.name) {
    state.kv.companyName = company.name;
    const companyInput = document.getElementById('kv-companyName');
    if (companyInput) companyInput.value = company.name;
  }

  // 2. 업종 기반 배경 이미지 자동 선택
  if (company.industry) {
    const bgUrl = pickBgImageByKeywords(company.industry);
    if (bgUrl && bgUrl !== state.kv.bgImageUrl) {
      state.kv.bgImageUrl = bgUrl;
      const bgUrlInput = document.getElementById('kv-bg-url');
      if (bgUrlInput) bgUrlInput.value = bgUrl;
    }
  }

  // 3. 로고 이미지 적용 (base64 변환)
  if (company.logoUrl && !state.kv.logoDataUrl) {
    try {
      let fetchUrl = company.logoUrl;
      let resp;
      try {
        resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(5000) });
      } catch {
        resp = await fetch(PROXY_BASE + encodeURIComponent(fetchUrl), { signal: AbortSignal.timeout(5000) });
      }
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.type.startsWith('image/')) {
          const reader = new FileReader();
          const dataUrl = await new Promise(resolve => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          state.kv.logoDataUrl = dataUrl;
          const logoPreview = document.getElementById('kv-logo-preview');
          if (logoPreview) {
            logoPreview.classList.remove('hidden');
            logoPreview.querySelector('img').src = dataUrl;
          }
        }
      }
    } catch (e) {
      console.warn('[CompanySearch] 로고 로드 실패:', e.message);
    }
  }

  // 4. KV 미리보기 갱신
  renderKvPreview();
  saveSession();

  // 5. 채팅 메시지
  const info = [company.industry, company.size].filter(Boolean).join(' · ');
  addMessage('assistant', `✓ **${company.name}** 정보를 키비주얼에 적용했습니다.${info ? ` (${info})` : ''}`);
}

async function searchKvImages() {
  const keyword = document.getElementById('kv-img-keyword')?.value.trim();
  if (!keyword) return;

  const resultsDiv = document.getElementById('kv-img-results');
  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = '<div class="kv-img-loading">🔍 검색 중... (로컬 + API)</div>';

  // 카테고리 자동 감지 (원문이 있으면)
  const detectedCategory = state.originalSource?.raw ? detectCategory(state.originalSource.raw) : 'business';

  // API 키 수집
  const apiKeys = {
    unsplashKey: state.unsplashApiKey || '',
    pexelsKey: state.pexelsApiKey || '',
    pixabayKey: state.pixabayApiKey || '',
  };

  // Check which sources are enabled
  const sourcesEnabled = [];
  document.querySelectorAll('[data-img-src]:checked').forEach(cb => sourcesEnabled.push(cb.dataset.imgSrc));

  // Filter API keys based on enabled sources
  if (!sourcesEnabled.includes('unsplash')) delete apiKeys.unsplashKey;
  if (!sourcesEnabled.includes('pexels')) delete apiKeys.pexelsKey;
  if (!sourcesEnabled.includes('pixabay')) delete apiKeys.pixabayKey;

  // Check if any API key is available
  const hasAnyKey = Object.values(apiKeys).some(k => k);
  const includeImageDB = sourcesEnabled.includes('imagedb');
  const includeIncruit = sourcesEnabled.includes('incruit');

  try {
    // 통합 이미지 검색 (로컬 + API)
    const allImages = await searchKvImagesLib(detectedCategory, keyword, apiKeys);

    // 이미지DB 검색 추가
    if (includeImageDB) {
      try {
        const dbResults = await imageDB.searchImages(keyword);
        const dbMapped = dbResults.map(img => ({
          id: img.id,
          thumbnailUrl: imageDB.blobToUrl(img.thumbBlob),
          fullUrl: imageDB.blobToUrl(img.fullBlob),
          alt: img.name,
          credit: img.source === 'figma' ? 'Figma' : '내 이미지',
          creditUrl: '#',
          downloadUrl: null,
          source: img.source === 'figma' ? 'figma' : 'imagedb',
          _blobUrls: true,
        }));
        allImages.unshift(...dbMapped);
      } catch (dbErr) {
        console.warn('[ImageDB] 검색 실패:', dbErr);
      }
    }

    // incruit 서버 이미지 검색 추가
    if (includeIncruit) {
      try {
        const incruitResults = await searchIncruitServerImages(keyword);
        allImages.unshift(...incruitResults);
      } catch (incruitErr) {
        console.warn('[Incruit] 검색 실패:', incruitErr);
      }
    }

    if (allImages.length === 0) {
      if (!hasAnyKey) {
        resultsDiv.innerHTML = `
          <div class="kv-img-empty">
            API 키가 설정되지 않았습니다.<br>
            <a href="#" class="kv-img-settings-link" style="color:var(--accent-color);text-decoration:underline;">설정</a>에서 API 키를 입력하거나,<br>
            카테고리: <strong>${KV_CATEGORIES[detectedCategory]?.name || detectedCategory}</strong>의 로컬 이미지를 추가해주세요.
          </div>`;
        resultsDiv.querySelector('.kv-img-settings-link')?.addEventListener('click', (e) => {
          e.preventDefault();
          openAiSettingsModal();
        });
      } else {
        resultsDiv.innerHTML = '<div class="kv-img-empty">검색 결과가 없습니다. 다른 키워드를 시도해보세요.</div>';
      }
      return;
    }

    // 결과 렌더링
    renderImageResults(resultsDiv, allImages);

    // 로그: 소스별 개수
    const sourceCount = {};
    allImages.forEach(img => {
      sourceCount[img.source] = (sourceCount[img.source] || 0) + 1;
    });
    console.log('[ImageSearch] 결과:', sourceCount);
  } catch (err) {
    console.error('[ImageSearch]', err);
    resultsDiv.innerHTML = '<div class="kv-img-empty">이미지 검색 중 오류가 발생했습니다.</div>';
  }
}

const INCRUIT_IMG_BASE = 'https://c.incru.it/newjobpost/job_vs_sample/2026/';
const INCRUIT_MANIFEST_URL = 'https://betaimg.incruit.com/ui/job_vs_sample/2026/manifest.json';
let _incruitManifestCache = null;

async function searchIncruitServerImages(keyword) {
  // 캐시된 manifest 재사용
  if (!_incruitManifestCache) {
    let filenames = null;

    // 1. 로컬 프록시 시도 (localhost 개발 환경)
    try {
      const proxyUrl = `/proxy/?url=${encodeURIComponent(INCRUIT_MANIFEST_URL)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) filenames = data;
      }
    } catch { /* 프록시 없음 — 다음 단계로 */ }

    // 2. 직접 fetch 시도 (CORS 허용 시)
    if (!filenames) {
      try {
        const res = await fetch(INCRUIT_MANIFEST_URL, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) filenames = data;
        }
      } catch { /* CORS 차단 — 다음 단계로 */ }
    }

    // 3. 정적 목록으로 폴백 (항상 동작)
    _incruitManifestCache = filenames ?? INCRUIT_SAMPLE_IMAGES.map(img => img.filename);
  }

  let filenames = _incruitManifestCache;
  if (filenames.length === 0) return [];

  if (keyword) {
    filenames = filenames.filter(name =>
      name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  return filenames.map(name => {
    const url = INCRUIT_IMG_BASE + name;
    return {
      thumbnailUrl: url,
      fullUrl: url,
      alt: name,
      credit: 'Incruit',
      creditUrl: '#',
      downloadUrl: null,
      source: 'incruit',
    };
  });
}

function renderImageResults(container, images) {
  const badgeMap = { unsplash: 'U', pexels: 'P', pixabay: 'Px', local: 'L', imagedb: 'DB', figma: 'F', incruit: 'I' };

  container.innerHTML = images.map(img => `
    <div class="kv-img-result-item" data-url="${img.fullUrl || img.full || ''}" data-source="${img.source}" data-thumb="${img.thumbnailUrl || img.thumb || ''}">
      <img src="${img.thumbnailUrl || img.thumb || ''}" alt="${img.alt || img.title || ''}" loading="lazy">
      <div class="kv-img-badge kv-img-badge-${img.source}">${badgeMap[img.source] || img.source[0]?.toUpperCase()}</div>
      <div class="kv-img-credit" title="${img.credit || img.author || ''}">
        <a href="${img.creditUrl || '#'}" target="_blank" rel="noopener" onclick="event.stopPropagation();">${img.credit || img.author || ''}</a>
      </div>
    </div>
  `).join('');

  // Attach click-to-select handlers
  container.querySelectorAll('.kv-img-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      state.kv.bgImageUrl = url;
      document.getElementById('kv-bg-url').value = url;
      renderKvPreview();

      // Visual selection feedback
      container.querySelectorAll('.kv-img-result-item').forEach(i => i.classList.remove('kv-img-selected'));
      item.classList.add('kv-img-selected');

      // Unsplash download tracking (API guideline compliance)
      const selectedImg = images.find(i => (i.fullUrl || i.full) === url);
      const dlUrl = selectedImg?.downloadUrl || selectedImg?.download;
      if (dlUrl && state.unsplashApiKey) {
        fetch(dlUrl, {
          headers: { 'Authorization': `Client-ID ${state.unsplashApiKey}` }
        }).catch(() => {});
      }
    });
  });
}

function updateImgSearchKeyWarning() {
  const noKeysDiv = document.getElementById('kv-img-no-keys');
  if (!noKeysDiv) return;
  const hasAnyKey = state.unsplashApiKey || state.pexelsApiKey || state.pixabayApiKey;
  noKeysDiv.classList.toggle('hidden', !!hasAnyKey);

  // Disable checkboxes for sources without keys
  const unsplashCb = document.querySelector('[data-img-src="unsplash"]');
  const pexelsCb = document.querySelector('[data-img-src="pexels"]');
  const pixabayCb = document.querySelector('[data-img-src="pixabay"]');
  if (unsplashCb) unsplashCb.disabled = !state.unsplashApiKey;
  if (pexelsCb) pexelsCb.disabled = !state.pexelsApiKey;
  if (pixabayCb) pixabayCb.disabled = !state.pixabayApiKey;
}

// ============================================
// Image DB 관리
// ============================================

async function handleImageDBUpload(files) {
  const category = document.getElementById('imagedb-category')?.value || 'business';
  const tagsInput = document.getElementById('imagedb-tags')?.value || '';
  const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

  let uploaded = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      await imageDB.addImage({ file, name: file.name.replace(/\.[^.]+$/, ''), category, tags });
      uploaded++;
    } catch (err) {
      console.error('[ImageDB] 업로드 실패:', file.name, err);
    }
  }

  if (uploaded > 0) {
    showToast(`${uploaded}개 이미지가 추가되었습니다.`);
    refreshImageDBGrid();
  }
}

async function refreshImageDBGrid() {
  const grid = document.getElementById('imagedb-grid');
  const statsEl = document.getElementById('imagedb-stats');
  if (!grid) return;

  const filterCategory = document.getElementById('imagedb-filter-category')?.value || '';
  const filters = filterCategory ? { category: filterCategory } : {};

  try {
    const images = await imageDB.getImages(filters);
    const stats = await imageDB.getStats();
    const sizeMB = (stats.totalSize / 1024 / 1024).toFixed(1);
    if (statsEl) statsEl.textContent = `${stats.count}개 (${sizeMB} MB)`;

    if (images.length === 0) {
      grid.classList.add('hidden');
      return;
    }

    grid.classList.remove('hidden');
    grid.innerHTML = images.map(img => {
      const thumbUrl = imageDB.blobToUrl(img.thumbBlob);
      const sourceBadge = img.source === 'figma' ? 'F' : 'DB';
      const badgeClass = img.source === 'figma' ? 'figma' : 'imagedb';
      return `
        <div class="imagedb-item" data-id="${img.id}">
          <img src="${thumbUrl}" alt="${img.name}" loading="lazy">
          <div class="kv-img-badge kv-img-badge-${badgeClass}">${sourceBadge}</div>
          <div class="imagedb-item-overlay">
            <span class="imagedb-item-name">${img.name}</span>
            <div class="imagedb-item-actions">
              <button class="imagedb-btn-use" title="KV 배경으로 사용">사용</button>
              <button class="imagedb-btn-delete" title="삭제">삭제</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 이벤트 핸들러
    grid.querySelectorAll('.imagedb-item').forEach(item => {
      const id = parseInt(item.dataset.id);

      item.querySelector('.imagedb-btn-use')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const img = await imageDB.getImageById(id);
        if (!img) return;
        const url = imageDB.blobToUrl(img.fullBlob);
        state.kv.bgImageUrl = url;
        document.getElementById('kv-bg-url').value = '(이미지DB)';
        renderKvPreview();
        showToast('배경 이미지가 적용되었습니다.');
      });

      item.querySelector('.imagedb-btn-delete')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('이 이미지를 삭제하시겠습니까?')) return;
        await imageDB.deleteImage(id);
        refreshImageDBGrid();
        showToast('이미지가 삭제되었습니다.');
      });
    });

    // Blob URL 해제 (이미지 로드 후)
    grid.querySelectorAll('img').forEach(imgEl => {
      imgEl.addEventListener('load', () => {
        if (imgEl.src.startsWith('blob:')) URL.revokeObjectURL(imgEl.src);
      });
    });
  } catch (err) {
    console.error('[ImageDB] 그리드 새로고침 실패:', err);
  }
}

async function handleImageDBExport() {
  try {
    const blob = await imageDB.exportDB();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imagedb-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('이미지DB를 내보냈습니다.');
  } catch (err) {
    console.error('[ImageDB] 내보내기 실패:', err);
    showToast('내보내기 중 오류가 발생했습니다.');
  }
}

async function handleImageDBImport(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  try {
    const count = await imageDB.importDB(file);
    showToast(`${count}개 이미지를 가져왔습니다.`);
    refreshImageDBGrid();
  } catch (err) {
    console.error('[ImageDB] 가져오기 실패:', err);
    showToast('가져오기 중 오류가 발생했습니다. 파일 형식을 확인해주세요.');
  }
  e.target.value = '';
}

// ============================================
// Figma 연동
// ============================================

function updateFigmaTokenWarning() {
  const noTokenDiv = document.getElementById('figma-no-token');
  if (!noTokenDiv) return;
  noTokenDiv.classList.toggle('hidden', !!state.figmaToken);
}

let _figmaFramesCache = [];

async function handleFigmaLoad() {
  const urlInput = document.getElementById('figma-file-url');
  const framesDiv = document.getElementById('figma-frames');
  const controlsDiv = document.getElementById('figma-import-controls');
  const statusDiv = document.getElementById('figma-status');
  if (!urlInput || !framesDiv) return;

  const fileKey = imageDB.parseFigmaUrl(urlInput.value.trim());
  if (!fileKey) {
    showToast('올바른 Figma 파일 URL을 입력해주세요.');
    return;
  }
  if (!state.figmaToken) {
    showToast('Figma 토큰이 설정되지 않았습니다. 설정에서 토큰을 입력해주세요.');
    return;
  }

  statusDiv.textContent = '파일 불러오는 중...';
  statusDiv.classList.remove('hidden');
  framesDiv.classList.add('hidden');
  controlsDiv?.classList.add('hidden');

  try {
    const frames = await imageDB.fetchFigmaFrames(fileKey, state.figmaToken);
    _figmaFramesCache = frames;

    if (frames.length === 0) {
      statusDiv.textContent = '프레임을 찾을 수 없습니다.';
      return;
    }

    // 썸네일 가져오기
    let thumbnails = {};
    try {
      thumbnails = await imageDB.getFigmaThumbnails(fileKey, frames.map(f => f.id), state.figmaToken);
    } catch { /* 썸네일 없어도 진행 */ }

    framesDiv.classList.remove('hidden');
    framesDiv.innerHTML = `<div class="figma-hint">클릭하여 KV 배경에 적용</div>` + frames.map((f, i) => `
      <div class="figma-frame-item" data-idx="${i}" role="button" tabindex="0">
        <div class="figma-frame-thumb">
          ${thumbnails[f.id] ? `<img src="${thumbnails[f.id]}" alt="${f.name}" loading="lazy">` : '<div class="figma-frame-placeholder"></div>'}
        </div>
        <div class="figma-frame-info">
          <span class="figma-frame-name">${f.name}</span>
          <span class="figma-frame-size">${f.width}x${f.height} &middot; ${f.pageName}</span>
        </div>
      </div>
    `).join('');

    // 클릭하여 KV 배경에 바로 적용
    framesDiv.querySelectorAll('.figma-frame-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        applyFigmaFrameToKv(idx, item);
      });
    });

    controlsDiv?.classList.remove('hidden');
    statusDiv.textContent = `${frames.length}개 프레임 발견`;
  } catch (err) {
    console.error('[Figma]', err);
    statusDiv.textContent = `오류: ${err.message}`;
    _figmaFramesCache = [];
  }
}

async function handleFigmaImport() {
  const urlInput = document.getElementById('figma-file-url');
  const statusDiv = document.getElementById('figma-status');
  const category = 'creative';
  const tags = ['figma'];

  const fileKey = imageDB.parseFigmaUrl(urlInput?.value?.trim() || '');
  if (!fileKey || !state.figmaToken) return;

  // 선택된 프레임 = 현재 선택된 것 (figma-frame-selected) 또는 전체
  const selectedFrames = [];
  const selectedEl = document.querySelector('#figma-frames .figma-frame-selected');
  if (selectedEl) {
    const idx = parseInt(selectedEl.dataset.idx);
    if (_figmaFramesCache[idx]) selectedFrames.push(_figmaFramesCache[idx]);
  } else {
    selectedFrames.push(..._figmaFramesCache);
  }

  if (selectedFrames.length === 0) {
    showToast('가져올 프레임을 선택해주세요.');
    return;
  }

  statusDiv.textContent = `${selectedFrames.length}개 프레임 가져오는 중...`;
  statusDiv.classList.remove('hidden');

  try {
    const imported = await imageDB.importFromFigma(fileKey, selectedFrames, state.figmaToken, category, tags);
    statusDiv.textContent = `${imported}개 프레임을 가져왔습니다.`;
    showToast(`Figma에서 ${imported}개 이미지를 가져왔습니다.`);
    refreshImageDBGrid();
  } catch (err) {
    console.error('[Figma Import]', err);
    statusDiv.textContent = `가져오기 실패: ${err.message}`;
    showToast('Figma 가져오기 중 오류가 발생했습니다.');
  }
}

async function applyFigmaFrameToKv(idx, itemEl) {
  const frame = _figmaFramesCache[idx];
  if (!frame) return;

  const urlInput = document.getElementById('figma-file-url');
  const statusDiv = document.getElementById('figma-status');
  const fileKey = imageDB.parseFigmaUrl(urlInput?.value?.trim() || '');
  if (!fileKey || !state.figmaToken) return;

  // 로딩 상태 표시
  const framesDiv = document.getElementById('figma-frames');
  framesDiv?.querySelectorAll('.figma-frame-item').forEach(el => el.classList.remove('figma-frame-selected'));
  itemEl.classList.add('figma-frame-selected', 'figma-frame-loading');
  statusDiv.textContent = `"${frame.name}" 적용 중...`;
  statusDiv.classList.remove('hidden');

  try {
    // Figma에서 고해상도 PNG export URL 취득
    const imageUrls = await imageDB.exportFigmaNodes(fileKey, [frame.id], state.figmaToken, 'png', 2);
    const imgUrl = imageUrls[frame.id];
    if (!imgUrl) throw new Error('이미지 URL을 받지 못했습니다.');

    // CSS background-image는 CORS 불필요 → URL 직접 적용
    if (state.kv.bgImageUrl && state.kv.bgImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(state.kv.bgImageUrl);
    }
    state.kv.bgImageUrl = imgUrl;
    document.getElementById('kv-bg-url').value = `(Figma: ${frame.name})`;
    renderKvPreview();

    itemEl.classList.remove('figma-frame-loading');
    statusDiv.textContent = `"${frame.name}" 배경 적용 완료`;
    showToast(`"${frame.name}"을 KV 배경으로 적용했습니다.`);
  } catch (err) {
    console.error('[Figma Apply]', err);
    itemEl.classList.remove('figma-frame-selected', 'figma-frame-loading');
    statusDiv.textContent = `적용 실패: ${err.message}`;
    showToast('Figma 이미지 적용 중 오류가 발생했습니다.');
  }
}

// ============================================
// Figma Variables Template KV
// ============================================

/** 로드된 Figma 변수 메타 캐시 */
let _figmaVarsMeta = null;

/** KV 필드 → Figma 변수 매핑 상태 (state에는 저장하지 않고 세션 내 유지) */
let _figmaVarMapping = {
  title: '',       // Figma 변수 ID
  description: '',
  companyName: '',
  jobCode: '',
  date: '',
};

/**
 * Figma 변수 목록을 불러와 매핑 UI에 렌더링
 */
async function handleFigmaVariablesLoad() {
  const urlInput = document.getElementById('figma-file-url');
  const statusDiv = document.getElementById('figma-vars-status');
  const mappingDiv = document.getElementById('figma-vars-mapping');

  const fileKey = imageDB.parseFigmaUrl(urlInput?.value?.trim() || '');
  if (!fileKey) { showToast('올바른 Figma 파일 URL을 입력해주세요.'); return; }
  if (!state.figmaToken) { showToast('Figma 토큰이 설정되지 않았습니다. 설정에서 토큰을 입력해주세요.'); return; }

  statusDiv.textContent = '변수 불러오는 중...';
  statusDiv.classList.remove('hidden');
  mappingDiv.classList.add('hidden');

  try {
    _figmaVarsMeta = await imageDB.fetchFigmaVariables(fileKey, state.figmaToken);
    const stringVars = imageDB.filterStringVariables(_figmaVarsMeta);

    if (stringVars.length === 0) {
      statusDiv.textContent = '이 파일에 STRING 타입 변수가 없습니다. Figma에서 Variables를 추가해주세요.';
      return;
    }

    statusDiv.textContent = `변수 ${stringVars.length}개 발견`;

    // 옵션 HTML 생성
    const opts = `<option value="">-- 연결 안함 --</option>` +
      stringVars.map(v => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.collectionName ? v.collectionName + ' / ' + v.name : v.name)}</option>`).join('');

    const KV_FIELDS = [
      { key: 'title',       label: '제목' },
      { key: 'description', label: '설명' },
      { key: 'companyName', label: '기업명' },
      { key: 'jobCode',     label: '공고번호' },
      { key: 'date',        label: '날짜' },
    ];

    mappingDiv.innerHTML = KV_FIELDS.map(f => `
      <div class="figma-var-row">
        <span class="figma-var-label">${f.label}</span>
        <select class="figma-var-select" data-field="${f.key}">${opts}</select>
      </div>
    `).join('') + `
      <button id="btn-figma-vars-apply" class="btn-primary mt-2 w-full text-sm">
        Figma 변수 업데이트 후 이미지 내보내기
      </button>`;

    // 이전 매핑 복원
    mappingDiv.querySelectorAll('.figma-var-select').forEach(sel => {
      const savedId = _figmaVarMapping[sel.dataset.field] || '';
      if (savedId) sel.value = savedId;
      sel.addEventListener('change', () => {
        _figmaVarMapping[sel.dataset.field] = sel.value;
      });
    });

    mappingDiv.querySelector('#btn-figma-vars-apply')?.addEventListener('click', applyKvViaFigmaVariables);
    mappingDiv.classList.remove('hidden');
  } catch (err) {
    console.error('[Figma Vars]', err);
    statusDiv.textContent = `오류: ${err.message}`;
  }
}

/**
 * KV 현재 값 → Figma 변수 업데이트 → 해당 프레임 이미지로 export → KV 배경 적용
 */
async function applyKvViaFigmaVariables() {
  const urlInput = document.getElementById('figma-file-url');
  const statusDiv = document.getElementById('figma-vars-status');
  const btn = document.getElementById('btn-figma-vars-apply');

  const fileKey = imageDB.parseFigmaUrl(urlInput?.value?.trim() || '');
  if (!fileKey || !state.figmaToken) { showToast('Figma 파일 URL과 토큰을 확인해주세요.'); return; }
  if (!_figmaVarsMeta) { showToast('먼저 "변수 불러오기"를 실행해주세요.'); return; }

  // 현재 KV 값
  const kvValues = {
    title:       state.kv.title || '',
    description: state.kv.description || '',
    companyName: state.kv.companyName || '',
    jobCode:     state.kv.jobCode || '',
    date:        state.kv.date || '',
  };

  // 매핑된 변수만 업데이트 목록 구성
  const updates = [];
  const { variables = {}, variableCollections = {} } = _figmaVarsMeta;
  for (const [field, varId] of Object.entries(_figmaVarMapping)) {
    if (!varId) continue;
    const varInfo = variables[varId];
    if (!varInfo) continue;
    const col = variableCollections[varInfo.variableCollectionId] || {};
    const modeId = col.defaultModeId || '';
    if (!modeId) continue;
    updates.push({ variableId: varId, modeId, value: kvValues[field] });
  }

  if (updates.length === 0) {
    showToast('연결된 변수가 없습니다. 각 필드에 변수를 매핑해주세요.');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = '업데이트 중...'; }
  statusDiv.textContent = `변수 ${updates.length}개 업데이트 중...`;
  statusDiv.classList.remove('hidden');

  try {
    // 1. 변수 값 업데이트
    await imageDB.updateFigmaVariableValues(fileKey, state.figmaToken, updates);
    statusDiv.textContent = '변수 업데이트 완료. 이미지 내보내기 중...';

    // 2. 선택된 프레임 export (현재 선택된 프레임 or 첫 번째 프레임)
    const selectedEl = document.querySelector('#figma-frames .figma-frame-selected');
    const selectedIdx = selectedEl ? parseInt(selectedEl.dataset.idx || '0') : 0;
    const frame = _figmaFramesCache[selectedIdx];
    if (!frame) throw new Error('내보낼 프레임을 선택해주세요. Figma 프레임 목록에서 프레임을 먼저 클릭해주세요.');

    // 변수 반영 대기 (Figma 서버 처리 시간)
    await new Promise(r => setTimeout(r, 1500));

    const imageUrls = await imageDB.exportFigmaNodes(fileKey, [frame.id], state.figmaToken, 'png', 2);
    const imgUrl = imageUrls[frame.id];
    if (!imgUrl) throw new Error('이미지 URL을 받지 못했습니다.');

    // 3. KV 배경에 적용
    if (state.kv.bgImageUrl && state.kv.bgImageUrl.startsWith('blob:')) URL.revokeObjectURL(state.kv.bgImageUrl);
    state.kv.bgImageUrl = imgUrl;
    document.getElementById('kv-bg-url').value = `(Figma 변수: ${frame.name})`;
    renderKvPreview();

    statusDiv.textContent = `완료: "${frame.name}" 적용됨`;
    showToast('Figma 변수 업데이트 및 이미지 적용 완료!');
  } catch (err) {
    console.error('[Figma Vars Apply]', err);
    statusDiv.textContent = `오류: ${err.message}`;
    showToast('Figma 변수 적용 실패: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Figma 변수 업데이트 후 이미지 내보내기'; }
  }
}

// ============================================
// KV Auto-Fill from Source Content
// ============================================
const KV_DEFAULT_VALUES = {
  jobCode: '공고 제2026-0호',
  title: '기업명이 들어갑니다.\n공고명이 들어갑니다.\n최대 3줄까지 가능합니다.',
  description: '회사에 대한 소개가 들어갑니다.\n회사에 대한 소개가 들어갑니다.\n최대 3줄까지 가능합니다.',
  date: '2026년 2월 5일',
  companyName: '기업명'
};

/** 업종/직종별 배경 이미지 매핑 (Unsplash) */
const KV_BG_IMAGES = {
  // IT/개발
  it: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
  dev: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80',
  ai: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80',
  data: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
  // 비즈니스/사무
  office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
  business: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
  finance: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
  // 마케팅/디자인
  marketing: 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&q=80',
  design: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80',
  // 제조/건설
  manufacturing: 'https://images.unsplash.com/photo-1565034946575-8cb6be18d1e5?w=800&q=80',
  construction: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
  // 의료/바이오
  medical: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
  bio: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80',
  // 교육
  education: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
  // 물류/유통
  logistics: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80',
  retail: 'https://images.unsplash.com/photo-1556740758-90de940c5ef1?w=800&q=80',
  // 서비스/고객
  service: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=80',
  hr: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800&q=80',
  // 기본
  default: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
};

/** 업종 키 → 영어 검색 키워드 매핑 */
const KV_SEARCH_KEYWORDS = {
  ai: 'artificial intelligence technology',
  data: 'data analytics dashboard',
  dev: 'software development coding',
  it: 'technology server network',
  design: 'creative design workspace',
  marketing: 'digital marketing strategy',
  finance: 'finance banking corporate',
  medical: 'healthcare hospital medical',
  bio: 'biotech laboratory research',
  education: 'education university campus',
  manufacturing: 'factory manufacturing industrial',
  construction: 'construction architecture building',
  logistics: 'logistics warehouse shipping',
  retail: 'retail store shopping',
  hr: 'human resources teamwork',
  service: 'customer service support',
  business: 'business corporate office',
  office: 'modern office workspace',
};

/** 소스 텍스트에서 업종을 감지하여 영어 검색 키워드 반환 */
function suggestImageKeyword(text) {
  if (!text) return 'corporate office professional';
  const t = text.toLowerCase();
  const rules = [
    [/ai|인공지능|머신러닝|딥러닝|llm/i, 'ai'],
    [/데이터|data.*scientist|data.*engineer|분석/i, 'data'],
    [/개발|developer|engineer|프로그래머|프론트엔드|백엔드|풀스택|devops|소프트웨어/i, 'dev'],
    [/it|정보기술|시스템|클라우드|인프라|네트워크|보안|sre/i, 'it'],
    [/디자인|designer|ux|ui|그래픽|영상|크리에이티브/i, 'design'],
    [/마케팅|marketing|광고|홍보|pr|콘텐츠|seo|퍼포먼스/i, 'marketing'],
    [/재무|회계|finance|금융|투자|증권|은행|보험/i, 'finance'],
    [/의료|의사|간호|약사|병원|클리닉|헬스케어/i, 'medical'],
    [/바이오|제약|연구원|r&d|임상/i, 'bio'],
    [/교육|강사|교수|학교|academy|에듀/i, 'education'],
    [/제조|생산|공장|품질|qc|qa|설비/i, 'manufacturing'],
    [/건설|건축|시공|토목|인테리어/i, 'construction'],
    [/물류|배송|운송|유통|supply.*chain|scm|창고/i, 'logistics'],
    [/유통|리테일|매장|판매|영업|retail/i, 'retail'],
    [/인사|hr|채용|교육훈련|노무|총무/i, 'hr'],
    [/고객|cs|서비스|상담|지원|support|헬프데스크/i, 'service'],
    [/경영|기획|전략|사업|비즈니스|컨설팅/i, 'business'],
  ];
  for (const [regex, key] of rules) {
    if (regex.test(t)) return KV_SEARCH_KEYWORDS[key];
  }
  return KV_SEARCH_KEYWORDS.office;
}

/** 텍스트에서 업종 키워드를 탐지하여 적절한 배경 이미지 URL 반환 */
function pickBgImageByKeywords(text) {
  if (!text) return KV_BG_IMAGES.default;
  const t = text.toLowerCase();
  const rules = [
    [/ai|인공지능|머신러닝|딥러닝|llm/i, 'ai'],
    [/데이터|data.*scientist|data.*engineer|분석/i, 'data'],
    [/개발|developer|engineer|프로그래머|프론트엔드|백엔드|풀스택|devops|소프트웨어/i, 'dev'],
    [/it|정보기술|시스템|클라우드|인프라|네트워크|보안|sre/i, 'it'],
    [/디자인|designer|ux|ui|그래픽|영상|크리에이티브/i, 'design'],
    [/마케팅|marketing|광고|홍보|pr|콘텐츠|seo|퍼포먼스/i, 'marketing'],
    [/재무|회계|finance|금융|투자|증권|은행|보험/i, 'finance'],
    [/의료|의사|간호|약사|병원|클리닉|헬스케어/i, 'medical'],
    [/바이오|제약|연구원|r&d|임상/i, 'bio'],
    [/교육|강사|교수|학교|academy|에듀/i, 'education'],
    [/제조|생산|공장|품질|qc|qa|설비/i, 'manufacturing'],
    [/건설|건축|시공|토목|인테리어/i, 'construction'],
    [/물류|배송|운송|유통|supply.*chain|scm|창고/i, 'logistics'],
    [/유통|리테일|매장|판매|영업|retail/i, 'retail'],
    [/인사|hr|채용|교육훈련|노무|총무/i, 'hr'],
    [/고객|cs|서비스|상담|지원|support|헬프데스크/i, 'service'],
    [/경영|기획|전략|사업|비즈니스|컨설팅/i, 'business'],
  ];
  for (const [regex, key] of rules) {
    if (regex.test(t)) return KV_BG_IMAGES[key];
  }
  return KV_BG_IMAGES.office; // 기본값: 사무실
}

function isKvFieldDefault() {
  // KV 텍스트 필드가 모두 기본값이면 true (사용자가 아직 수정 안 함)
  return state.kv.jobCode === KV_DEFAULT_VALUES.jobCode &&
         state.kv.title === KV_DEFAULT_VALUES.title &&
         state.kv.description === KV_DEFAULT_VALUES.description &&
         state.kv.companyName === KV_DEFAULT_VALUES.companyName;
}

function tryAutoFillKvFromSource() {
  // 소스 에디터에 내용이 없거나 KV 필드를 이미 수정했으면 스킵
  const sourceText = (elements.sourceEditor.innerText || '').trim();
  if (!sourceText || sourceText.length < 10) return false;
  if (!isKvFieldDefault()) return false;

  // 공고 내용에서 정보 추출 시도
  const extracted = parseJobPostContent(sourceText);
  if (!extracted) return false;

  // 추출된 내용으로 KV 필드 채우기
  let changed = false;

  if (extracted.jobCode) {
    state.kv.jobCode = extracted.jobCode;
    document.getElementById('kv-job-code').value = extracted.jobCode;
    changed = true;
  }

  if (extracted.title) {
    state.kv.title = extracted.title;
    const _te2 = document.getElementById('kv-title'); if (_te2) { _te2.innerHTML = escapeHtml(extracted.title).replace(/\n/g, '<br>'); state.kv.titleHtml = _te2.innerHTML; }
    changed = true;
  }

  if (extracted.description) {
    state.kv.description = extracted.description;
    document.getElementById('kv-description').value = extracted.description;
    changed = true;
  }

  if (extracted.companyName) {
    state.kv.companyName = extracted.companyName;
    changed = true;
  }

  if (extracted.date) {
    state.kv.date = extracted.date;
    changed = true;
  }

  if (extracted.companyName || extracted.date) {
    state.kv.dateCompanyText = (state.kv.date || '') + '\n' + (state.kv.companyName || '');
    const _dcEl3 = document.getElementById('kv-date-company');
    if (_dcEl3) _dcEl3.value = state.kv.dateCompanyText;
  }

  // Settings 패널의 채용공고 번호도 참조
  if (!extracted.jobCode && state.jobNumber) {
    state.kv.jobCode = `공고 제${state.jobNumber}호`;
    document.getElementById('kv-job-code').value = state.kv.jobCode;
    changed = true;
  }

  // 배경 이미지 자동 선택 (기본 이미지일 때만)
  const defaultBg = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80';
  if (!state.kv.bgImageUrl || state.kv.bgImageUrl === defaultBg) {
    const autoBg = pickBgImageByKeywords(sourceText);
    if (autoBg && autoBg !== defaultBg) {
      state.kv.bgImageUrl = autoBg;
      const bgInput = document.getElementById('kv-bg-url');
      if (bgInput) bgInput.value = autoBg;
      changed = true;
    }
  }

  // 프리셋 자동 선택 (업종/분위기 기반)
  const bestPreset = detectBestPreset();
  applyKvPreset(bestPreset);
  changed = true;

  // 텍스트 내용에 따른 추가 최적화
  optimizeKvSettings(sourceText);

  if (changed) {
    renderKvPreview();
    console.info('[KV] 공고 내용에서 자동 추출 완료:', extracted);
    return true;
  }
  return false;
}

function optimizeKvSettings(sourceText) {
  const title = state.kv.title || '';
  const charCount = title.replace(/\n/g, '').length;
  const lineCount = (title.match(/\n/g) || []).length + 1;

  // 제목 길이에 따른 텍스트 정렬 최적화
  if (charCount <= 15 && lineCount <= 1) {
    // 짧은 1줄 제목 → 센터 정렬이 보기 좋음
    state.kv.textAlign = 'center';
  } else {
    // 2줄 이상 또는 긴 제목 → 좌측 정렬
    state.kv.textAlign = 'left';
  }

  // 배경 이미지 유무에 따른 효과 최적화
  if (state.kv.bgImageDataUrl || (state.kv.bgImageUrl && state.kv.bgImageUrl !== 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80')) {
    // 배경 이미지가 있으면 gradient로 텍스트 가독성 확보
    if (state.kv.templateType === 'overlay') {
      state.kv.effect = 'gradient';
      state.kv.textShadow = 'light';
    }
  }

  // 공공기관: 보수적 설정
  const t = sourceText.toLowerCase();
  if (/공공기관|공단|정부|공사|재단법인|지방자치/.test(t)) {
    state.kv.textShadow = 'light';
    state.kv.effect = 'gradient';
  }

  // 크리에이티브/디자인: 대담한 설정
  if (/디자인|크리에이티브|광고|미디어|콘텐츠/.test(t)) {
    state.kv.textShadow = 'medium';
    if (charCount <= 20) state.kv.textAlign = 'center';
  }

  updateKvControls();
}

function parseJobPostContent(text) {
  const result = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // 1. 공고번호 추출
  // 패턴: "공고번호", "채용공고 번호", "공고 번호", "공고번호:"
  for (const line of lines) {
    const jobCodeMatch = line.match(/(?:공고\s*(?:번호)?|채용공고\s*번호?)[\s:：]*([^\n]+)/i);
    if (jobCodeMatch) {
      result.jobCode = jobCodeMatch[1].trim().replace(/^[:\s]+/, '');
      break;
    }
  }

  // Settings의 채용공고 번호가 있으면 활용
  if (!result.jobCode && state.jobNumber) {
    result.jobCode = `공고 제${state.jobNumber}호`;
  }

  // 2. 기업명 추출
  // 패턴: "기업명:", "회사명:", "(주)", "(주)" 포함 라인, "주식회사"
  for (const line of lines) {
    const companyMatch = line.match(/(?:기업명|회사명|업체명|기관명)[\s:：]+([^\n,]+)/);
    if (companyMatch) {
      result.companyName = companyMatch[1].trim();
      break;
    }
  }
  if (!result.companyName) {
    for (const line of lines) {
      const corpMatch = line.match(/(?:\(주\)|㈜|주식회사)\s*([^\s,]+)|([^\s,]+)\s*(?:\(주\)|㈜|주식회사)/);
      if (corpMatch) {
        const name = (corpMatch[1] || corpMatch[2] || '').trim();
        if (name) {
          result.companyName = line.trim().substring(0, 30);
          break;
        }
      }
    }
  }

  // 3. 공고명/제목 추출
  // 보통 첫 번째 의미 있는 줄 또는 가장 굵은/큰 제목
  // 기업명/공고번호/날짜가 아닌 첫 번째 실질적 줄을 제목으로
  const skipPatterns = [
    /^공고/, /^채용공고/, /^번호/, /^\d{4}[-\/]/, /^접수/, /^마감/,
    /^기업명/, /^회사명/, /^업체명/, /^기관명/, /^근무/, /^급여/,
    /^자격/, /^우대/, /^제출/, /^전형/, /^문의/, /^담당/,
    /^\(주\)|^㈜|^주식회사/
  ];

  const titleCandidates = [];
  for (const line of lines) {
    if (line.length < 3 || line.length > 100) continue;
    if (skipPatterns.some(p => p.test(line))) continue;
    // 공고번호나 기업명 줄은 스킵
    if (result.jobCode && line.includes(result.jobCode)) continue;
    titleCandidates.push(line);
  }

  if (titleCandidates.length > 0) {
    // 첫 번째 후보를 제목으로
    const titleLine = titleCandidates[0];
    // 기업명이 있으면 "기업명\n공고명" 형태로
    if (result.companyName && !titleLine.includes(result.companyName)) {
      result.title = `${result.companyName}\n${titleLine}`;
    } else {
      result.title = titleLine;
    }
    // 제목이 너무 길면 줄바꿈으로 분리 (최대 3줄)
    if (result.title.length > 40 && !result.title.includes('\n')) {
      result.title = wrapText(result.title, 20);
    }
  }

  // 4. 설명 추출 (모집분야, 주요업무, 자격요건 등 키워드 뒤의 내용)
  const descKeywords = ['모집분야', '주요업무', '담당업무', '모집부문', '직무내용', '업무내용', '모집직종'];
  for (let i = 0; i < lines.length; i++) {
    if (descKeywords.some(kw => lines[i].includes(kw))) {
      // 해당 라인 이후 최대 3줄을 설명으로
      const descLines = [];
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const cleaned = lines[j].replace(/^[\s\-·•▶▷※]+/, '').trim();
        if (cleaned && cleaned.length > 2) {
          descLines.push(cleaned);
        }
      }
      if (descLines.length > 0) {
        result.description = descLines.slice(0, 3).join('\n');
        break;
      }
    }
  }

  // 설명이 없으면 제목 다음 후보들에서 가져오기
  if (!result.description && titleCandidates.length > 1) {
    result.description = titleCandidates.slice(1, 4).join('\n');
  }

  // 5. 날짜 추출
  for (const line of lines) {
    // 패턴: "2026.01.30", "2026-01-30", "2026년 01월 30일", "~2026.02.28"
    const dateMatch = line.match(/(\d{4})[.\-\/년]\s*(\d{1,2})[.\-\/월]\s*(\d{1,2})\s*일?/);
    if (dateMatch) {
      const [, y, m, d] = dateMatch;
      result.date = `${y}년 ${m.padStart(2, '0')}월 ${d.padStart(2, '0')}일`;
      break;
    }
  }

  // 추출 결과가 하나라도 있으면 반환
  return Object.keys(result).length > 0 ? result : null;
}

function wrapText(text, maxLen) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxLen && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
      if (lines.length >= 2) { // 최대 3줄
        currentLine = words.slice(words.indexOf(word)).join(' ');
        break;
      }
    } else {
      currentLine = (currentLine + ' ' + word).trim();
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines.slice(0, 3).join('\n');
}

function resetKv() {
  if (!confirm('키비주얼 설정을 초기화하시겠습니까?')) return;

  state.kv = {
    jobCode: '공고 제2026-0호',
    title: '기업명이 들어갑니다.\n공고명이 들어갑니다.\n최대 3줄까지 가능합니다.',
    description: '회사에 대한 소개가 들어갑니다.\n회사에 대한 소개가 들어갑니다.\n최대 3줄까지 가능합니다.',
    date: '2026년 2월 5일',
    companyName: '기업명',
    templateType: 'overlay',
    splitLayout: 'text-left',
    textAlign: 'left',
    effect: 'gradient',
    heightMode: 'fixed',
    bgColor: '#1f46a8',
    brandColor: '#16213d',
    logoDataUrl: '',
    bgImageDataUrl: '',
    bgImageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    fieldStyles: {
      jobCode:     { fontSize: 14, color: '#FFFFFF', bold: false },
      title:       { fontSize: 50, color: '#FFFFFF', bold: true },
      description: { fontSize: 13, color: '#FFFFFF', bold: false },
      dateCompany: { fontSize: 12, color: '#FFFFFF', bold: false }
    },
    textPosition: {
      jobCode:     { left: 30, top: 20 },
      title:       { left: 30, top: 65 },
      description: { left: 30, top: 180 },
      dateCompany: { left: 30, top: 260 }
    }
  };

  // Reset form inputs
  document.getElementById('kv-job-code').value = state.kv.jobCode;
  const _resetTitleEl = document.getElementById('kv-title'); if (_resetTitleEl) { const _rHtml = state.kv.titleHtml || escapeHtml(state.kv.title).replace(/\n/g, '<br>'); _resetTitleEl.innerHTML = _rHtml; }
  const _resetOrgEl = document.getElementById('kv-org-name'); if (_resetOrgEl) { const _rOrgHtml = state.kv.orgNameHtml || escapeHtml(state.kv.orgName || '').replace(/\n/g, '<br>'); _resetOrgEl.innerHTML = _rOrgHtml; }
  document.getElementById('kv-description').value = state.kv.description;
  const _dcElReset = document.getElementById('kv-date-company');
  if (_dcElReset) _dcElReset.value = state.kv.dateCompanyText != null
    ? state.kv.dateCompanyText
    : ((state.kv.date || '') + '\n' + (state.kv.companyName || '')).trim();
  document.getElementById('kv-bg-color').value = state.kv.bgColor;
  document.getElementById('kv-bg-color-text').value = state.kv.bgColor;
  document.getElementById('kv-brand-color').value = state.kv.brandColor;
  document.getElementById('kv-brand-color-text').value = state.kv.brandColor;
  document.getElementById('kv-bg-url').value = state.kv.bgImageUrl;
  document.getElementById('kv-bg-file').value = '';
  document.getElementById('kv-logo-file').value = '';
  document.getElementById('kv-bg-preview').classList.add('hidden');
  document.getElementById('kv-logo-preview').classList.add('hidden');

  // Reset option buttons
  document.querySelectorAll('[data-kv-type]').forEach(b => b.classList.toggle('active', b.dataset.kvType === 'overlay'));
  document.querySelectorAll('[data-kv-split-layout]').forEach(b => b.classList.toggle('active', b.dataset.kvSplitLayout === 'text-left'));
  const splitGroup = document.getElementById('kv-split-layout-group');
  if (splitGroup) splitGroup.style.display = 'none';
  document.querySelectorAll('[data-kv-align]').forEach(b => b.classList.toggle('active', b.dataset.kvAlign === 'left'));
  document.querySelectorAll('[data-kv-effect]').forEach(b => b.classList.toggle('active', b.dataset.kvEffect === 'gradient'));
  document.querySelectorAll('[data-kv-height]').forEach(b => b.classList.toggle('active', b.dataset.kvHeight === 'fixed'));

  // Reset field settings panels (close all + reset values)
  document.querySelectorAll('.kv-field-settings').forEach(panel => panel.classList.add('hidden'));
  document.querySelectorAll('.kv-field-toggle').forEach(btn => btn.textContent = '설정 ▼');

  // Reset field style inputs
  const fieldDefaults = state.kv.fieldStyles;
  Object.entries(fieldDefaults).forEach(([field, styles]) => {
    const panel = document.getElementById(`kv-settings-${field}`);
    if (!panel) return;
    const slider = panel.querySelector('.kv-slider');
    const numInput = panel.querySelector('.kv-value-input');
    const colorPicker = panel.querySelector('input[type="color"]');
    const hexInput = panel.querySelector('.kv-hex-input');
    const checkbox = panel.querySelector('input[type="checkbox"]');
    if (slider) slider.value = styles.fontSize;
    if (numInput) numInput.value = styles.fontSize;
    if (colorPicker) colorPicker.value = styles.color;
    if (hexInput) hexInput.value = styles.color;
    if (checkbox) checkbox.checked = styles.bold;
  });

  // Reset position panels
  document.querySelectorAll('.kv-pos-accordion .kv-collapsible-body').forEach(b => b.classList.add('hidden'));
  document.querySelectorAll('.kv-pos-toggle').forEach(b => b.classList.remove('open'));
  const posDefaults = state.kv.textPosition;
  Object.entries(posDefaults).forEach(([field, pos]) => {
    ['left', 'top'].forEach(axis => {
      const sliders = document.querySelectorAll(`[data-pos="${field}"][data-axis="${axis}"]`);
      sliders.forEach(s => { s.value = pos[axis]; });
    });
  });

  // Show/hide position section
  const posSection = document.getElementById('kv-text-position-section');
  if (posSection) posSection.classList.toggle('hidden', state.kv.heightMode !== 'fixed');

  renderKvPreview();
}

// ============================================
// Workflow System (simplified — no step navigation)
// ============================================

function setupWorkflow() {
  // Template selection (card-based)
  setupStep3Templates();

  // Editor is always editable
  if (elements.sourceEditor) {
    elements.sourceEditor.contentEditable = 'true';
  }

  // Update summary
  updateWfSummary();
}


// ---- Step 3: Template Selection (card-based) ----
function setupStep3Templates() {
  document.getElementById('wf-template-grid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.wf-template-card');
    if (!card) return;

    const templateId = card.dataset.template;

    // Update UI
    document.querySelectorAll('.wf-template-card').forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    // Sync with original select (for compatibility)
    state.template = templateId;
    elements.templateSelect.value = templateId;
    elements.templateName.textContent = templates[templateId]?.name || templateId;

    // 보더 이미지 입력 그룹 표시/숨김
    const borderImagesGroup = document.getElementById('border-images-group');
    if (borderImagesGroup) borderImagesGroup.style.display = templateId === 'standard_border' ? 'block' : 'none';

    updatePreview();
    renderKvPreview();
  });
}

// ---- Summary ----
function updateWfSummary() {
  const templateEl = document.getElementById('wf-sum-template');
  const statusEl = document.getElementById('wf-sum-status');

  if (templateEl) templateEl.textContent = templates[state.template]?.name || state.template;

  if (statusEl) {
    const hasContent = state.sourceContent || state.convertedHtml;
    statusEl.textContent = state.convertedHtml ? 'AI 변환 완료 ✓' : hasContent ? '원문 입력됨' : '준비 중';
    statusEl.className = state.convertedHtml ? 'text-green-400' : hasContent ? 'text-blue-400' : 'text-yellow-400';
  }
}


// ============================================
// Initialize App
// ============================================
document.addEventListener('DOMContentLoaded', init);
