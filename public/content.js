// Content script for LinkedIn AI Comment Generator Extension

class LinkedInCommentInjector {
    constructor() {
        this.init();
    }

    init() {
        // Wait for page to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.startObserving());
        } else {
            this.startObserving();
        }
    }

    startObserving() {
        // Create observer to watch for new posts and comment boxes
        const observer = new MutationObserver(() => {
            this.injectCommentButtons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial injection
        this.injectCommentButtons();
    }

    

    injectCommentButtons() {
        // Select all LinkedIn post containers
        const posts = document.querySelectorAll('[data-test-id="main-feed-activity-card"], .feed-shared-update-v2');
        posts.forEach(post => {
            // Prevent duplicate buttons
            if (post.querySelector('.ai-comment-generator-btn')) return;

            // Create and style the button
            const button = this.createAIButton('AI Comment');
            button.style.position = 'absolute';
            button.style.left = '16px';
            button.style.bottom = '16px';
            button.style.zIndex = '1000';

            // Make sure the post container is positioned relatively
            post.style.position = 'relative';

            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.openExtensionPopup();
            });

            post.appendChild(button);
        });
    }
    // ...existing code...

    createAIButton(text, isSmall = false) {
        const button = document.createElement('button');
        button.className = 'ai-comment-generator-btn';
        button.innerHTML = `
            <span style="margin-right: 4px;">✨</span>
            ${text}
        `;
        
        // Styling to match LinkedIn's design
        Object.assign(button.style, {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: isSmall ? '16px' : '8px',
            padding: isSmall ? '4px 12px' : '8px 16px',
            fontSize: isSmall ? '12px' : '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            zIndex: '1000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        // Hover effect
        button.addEventListener('mouseenter', () => {
            button.style.opacity = '0.9';
            button.style.transform = 'translateY(-1px)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.opacity = '1';
            button.style.transform = 'translateY(0)';
        });

        return button;
    }

    
    openExtensionPopup(commentBox = null) {
        // Remove any existing popup
        const existing = document.getElementById('linkedin-ai-injected-popup');
        if (existing) existing.remove();

        // Find the button and the post container
        const button = document.activeElement.closest('.ai-comment-generator-btn');
        const post = button ? button.closest('[data-test-id="main-feed-activity-card"], .feed-shared-update-v2') : null;
        const postContent = post ? this.extractCurrentPostContent(post) : null;

        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.id = 'linkedin-ai-injected-popup';
        iframe.src = chrome.runtime.getURL('injected-popup.html');
        iframe.style.position = 'absolute';
        iframe.style.left = button ? (button.offsetLeft + button.offsetWidth + 10) + 'px' : '40px';
        iframe.style.top = button ? button.offsetTop + 'px' : '40px';
        iframe.style.width = '380px';
        iframe.style.height = '600px';
        iframe.style.zIndex = '10001';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '12px';
        iframe.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
        iframe.style.background = 'white';

        // Insert into the post container or body
        if (post) {
            post.appendChild(iframe);
        } else {
            document.body.appendChild(iframe);
        }

        // Send post content to iframe after it loads
        iframe.onload = () => {
            if (postContent) {
                iframe.contentWindow.postMessage({
                    type: 'SET_POST_CONTENT',
                    postContent: postContent
                }, '*');
            }
        };

        // Close popup when clicking outside
        setTimeout(() => {
            document.addEventListener('mousedown', function handler(e) {
                if (!iframe.contains(e.target) && e.target !== button) {
                    iframe.remove();
                    document.removeEventListener('mousedown', handler);
                }
            });
        }, 100);
    }
    
    extractCurrentPostContent(postElement) {
        // Use the provided post element, or fallback to the first post
        const post = postElement || document.querySelector('[data-test-id="main-feed-activity-card"], .feed-shared-update-v2, .artdeco-card');
        if (!post) return null;

        const selectors = [
            '.feed-shared-text .break-words',
            '.feed-shared-text',
            '.feed-shared-update-v2__description .break-words',
            '.artdeco-entity-lockup__content .break-words',
            '[data-test-id="post-content"] .break-words'
        ];

        for (const selector of selectors) {
            const element = post.querySelector(selector);
            if (element && element.textContent.trim()) {
                return element.textContent.trim();
            }
        }

        return null;
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 300px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                animation: slideIn 0.3s ease-out;
            ">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span>✨</span>
                    <span>${message}</span>
                </div>
            </div>
        `;

        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Remove notification after 5 seconds
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 5000);
    }
}

// Initialize the injector
new LinkedInCommentInjector();