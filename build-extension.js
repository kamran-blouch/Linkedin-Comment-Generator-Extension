#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Building Chrome Extension...');

// Create extension directory
const extensionDir = 'extension-build';
if (fs.existsSync(extensionDir)) {
  fs.rmSync(extensionDir, { recursive: true });
}
fs.mkdirSync(extensionDir);

// Copy manifest.json
fs.copyFileSync('manifest.json', path.join(extensionDir, 'manifest.json'));

// Copy popup.html/injected-popup.html
fs.copyFileSync('popup.html', path.join(extensionDir, 'popup.html'));
fs.copyFileSync('injected-popup.html', path.join(extensionDir, 'injected-popup.html'));

// Copy public scripts
fs.copyFileSync('public/popup.js', path.join(extensionDir, 'popup.js'));
fs.copyFileSync('public/background.js', path.join(extensionDir, 'background.js'));
fs.copyFileSync('public/content.js', path.join(extensionDir, 'content.js'));
fs.copyFileSync('public/content.css', path.join(extensionDir, 'content.css'));

// Create icons directory and placeholder icons
const iconsDir = path.join(extensionDir, 'icons');
fs.mkdirSync(iconsDir);

// Create simple SVG icons (you can replace these with actual PNG icons)
const iconSvg = `<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="20" fill="url(#grad)"/>
  <text x="64" y="80" font-family="Arial, sans-serif" font-size="60" fill="white" text-anchor="middle">✨</text>
</svg>`;

// For a real extension, you'd want actual PNG files
// For now, we'll create placeholder files
fs.writeFileSync(path.join(iconsDir, 'icon16.png'), '');
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), '');
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), '');

// Create README for extension
const extensionReadme = `# LinkedIn AI Comment Generator - Chrome Extension

## Installation

1. Open Chrome and navigate to \`chrome://extensions/\`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select this directory
4. The extension should now appear in your extensions list

## Usage

1. Navigate to LinkedIn.com
2. Find a post you want to comment on
3. Click the extension icon in your toolbar
4. Use the popup to generate AI comments
5. Copy or directly insert comments into LinkedIn

## Features

- Generate AI comments with multiple tones
- Support for various AI models
- Direct content extraction from LinkedIn posts  
- One-click insertion into comment boxes
- Persistent preferences

## Notes

This extension requires an active internet connection to generate comments using AI.
`;

fs.writeFileSync(path.join(extensionDir, 'README.md'), extensionReadme);

console.log('✅ Extension built successfully in ./extension-build/');
console.log('\nTo install:');
console.log('1. Open Chrome -> Extensions (chrome://extensions/)');
console.log('2. Enable Developer Mode');
console.log('3. Click "Load Unpacked" and select the extension-build folder');
console.log('\n🚀 Your extension is ready to use!');