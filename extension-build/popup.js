class LinkedInAIExtension {
   
    constructor() {
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SET_POST_CONTENT') {
                    document.getElementById('post-content').value = event.data.postContent;
                }
            });
            this.initializeEventListeners();
            this.loadSavedData();
        }

    initializeEventListeners() {
        /*
        document.getElementById('get-content-btn').addEventListener('click', () => this.getContentFromPage());
        */
        document.getElementById('generate-btn').addEventListener('click', () => this.generateComment());
        document.getElementById('copy-btn').addEventListener('click', () => this.copyComment());
        //document.getElementById('insert-btn').addEventListener('click', () => this.insertComment());
        
        // Save preferences on change
        document.getElementById('tone-select').addEventListener('change', () => this.savePreferences());
        document.getElementById('model-select').addEventListener('change', () => this.savePreferences());
    }
    
    async loadSavedData() {
        try {
            // Try up to 10 times (1 second total) to get currentPostContent
            let result = {};
            for (let i = 0; i < 10; i++) {
                result = await chrome.storage.local.get(['preferences', 'lastComment', 'currentPostContent']);
                if (result.currentPostContent) break;
                await new Promise(res => setTimeout(res, 100));
            }

            if (result.preferences) {
                document.getElementById('tone-select').value = result.preferences.tone || 'professional';
                document.getElementById('model-select').value = result.preferences.model || 'gpt-4.1-2025-04-14';
            }

            // Auto-fill post content if available
            if (result.currentPostContent) {
                document.getElementById('post-content').value = result.currentPostContent;
                chrome.storage.local.remove(['currentPostContent']);
            }

            if (result.lastComment) {
                this.displayGeneratedComment(result.lastComment);
            }
        } catch (error) {
            console.error('Error loading saved data:', error);
        }
    }
    async savePreferences() {
        try {
            const preferences = {
                tone: document.getElementById('tone-select').value,
                model: document.getElementById('model-select').value
            };
            await chrome.storage.local.set({ preferences });
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }
    
    async generateComment() {
        const postContent = document.getElementById('post-content').value.trim();
        const tone = document.getElementById('tone-select').value;
        const model = document.getElementById('model-select').value;
        const hint = document.getElementById('hint-input').value.trim();

        if (!postContent) {
            this.showStatus('Please enter post content or get it from the page first', 'error');
            return;
        }

        this.setGeneratingState(true);
        this.showStatus('Generating AI comment...', 'info');

        try {
            // Send message to background script to handle API call
            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                data: {
                    postCaption: postContent,
                    tone: tone,
                    model: model,
                    hint: hint || undefined
                }
            });

            if (response.success) {
                const commentData = {
                    text: response.comment,
                    tone: tone,
                    model: model,
                    timestamp: new Date().toISOString()
                };

                this.displayGeneratedComment(commentData);
                await chrome.storage.local.set({ lastComment: commentData });
                this.showStatus('Comment generated successfully!', 'success');
            } else {
                throw new Error(response.error || 'Failed to generate comment');
            }
        } catch (error) {
            console.error('Error generating comment:', error);
            this.showStatus('Error generating comment. Please try again.', 'error');
        } finally {
            this.setGeneratingState(false);
        }
    }

    displayGeneratedComment(commentData) {
        document.getElementById('comment-text').value = commentData.text;
        document.getElementById('tone-badge').textContent = commentData.tone;
        document.getElementById('model-badge').textContent = commentData.model;
        document.getElementById('generated-comment').style.display = 'block';
    }

    async copyComment() {
        try {
            const commentText = document.getElementById('comment-text').value;
            await navigator.clipboard.writeText(commentText);
            this.showStatus('Comment copied to clipboard!', 'success');
        } catch (error) {
            console.error('Error copying comment:', error);
            this.showStatus('Error copying comment', 'error');
        }
    }

    /*
    async insertComment() {
        try {
            const commentText = document.getElementById('comment-text').value;
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab.url.includes('linkedin.com')) {
                this.showStatus('Please navigate to LinkedIn first', 'error');
                return;
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: this.insertCommentToPage,
                args: [commentText]
            });

            this.showStatus('Comment inserted to LinkedIn!', 'success');
            window.close(); // Close popup after successful insertion
        } catch (error) {
            console.error('Error inserting comment:', error);
            this.showStatus('Error inserting comment. Please try manually.', 'error');
        }
    }

    insertCommentToPage(commentText) {
        // This function runs in the context of the LinkedIn page
        const commentSelectors = [
            '.ql-editor[data-placeholder*="comment"]',
            '.ql-editor[aria-label*="comment" i]',
            'div[data-artdeco-is-focused="true"].ql-editor',
            '.comments-comment-box__form .ql-editor',
            '.comment-form .ql-editor',
            'div[role="textbox"][aria-label*="comment" i]'
        ];

        let commentBox = null;
        
        // Try to find an active comment box
        for (const selector of commentSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                // Check if the element is visible and potentially active
                if (element.offsetParent !== null && 
                    (element.textContent.trim() === '' || element.getAttribute('data-artdeco-is-focused') === 'true')) {
                    commentBox = element;
                    break;
                }
            }
            if (commentBox) break;
        }

        if (commentBox) {
            // Clear existing content and insert new comment
            commentBox.focus();
            commentBox.innerHTML = `<p>${commentText}</p>`;
            
            // Trigger input events to ensure LinkedIn recognizes the change
            const inputEvent = new Event('input', { bubbles: true });
            commentBox.dispatchEvent(inputEvent);
            
            return true;
        }

        // If no comment box found, try to open one by clicking comment button
        const commentButtons = document.querySelectorAll('button[aria-label*="comment" i], .comment-button, .social-actions-button--comment');
        if (commentButtons.length > 0) {
            commentButtons[0].click();
            
            // Wait a bit and try again
            setTimeout(() => {
                const newCommentBox = document.querySelector('.ql-editor[data-placeholder*="comment"], .ql-editor[aria-label*="comment" i]');
                if (newCommentBox) {
                    newCommentBox.focus();
                    newCommentBox.innerHTML = `<p>${commentText}</p>`;
                    const inputEvent = new Event('input', { bubbles: true });
                    newCommentBox.dispatchEvent(inputEvent);
                }
            }, 1000);
        }

        return false;
    }
    */

    setGeneratingState(isGenerating) {
        const generateBtn = document.getElementById('generate-btn');
        const generateText = document.getElementById('generate-text');
        const generateSpinner = document.getElementById('generate-spinner');

        generateBtn.disabled = isGenerating;
        generateText.style.display = isGenerating ? 'none' : 'inline';
        generateSpinner.style.display = isGenerating ? 'inline-block' : 'none';
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = type === 'error' ? 'status-message error' : 'status-message';
        statusEl.style.display = 'block';

        // Auto-hide success/info messages after 3 seconds
        if (type !== 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }
}

// Initialize the extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LinkedInAIExtension();
});