class LinkedInAIExtension {
    constructor() {
        // Models by provider
        this.modelsByProvider = {
            openai: [
                { value: "gpt-4.1-2025-04-14", label: "GPT-4.1 (Flagship)" },
                { value: "gpt-4o", label: "GPT-4o (High Quality)" },
                { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast)" },
                { value: "o3-2025-04-16", label: "O3 (Reasoning)" },
                { value: "o4-mini-2025-04-16", label: "O4 Mini (Fast Reasoning)" }
            ],
            groq: [
                { value: "qwen/qwen3-32b", label: "qwen/qwen3-32b" },
                { value: "deepseek-r1-distill-llama-70b", label: "deepseek-r1-distill-llama-70b" },
                { value: "gemma2-9b-it", label: "gemma2-9b-it" },
                { value: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant" },
                { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile" },
                { value: "openai/gpt-oss-120b", label: "openai/gpt-oss-120b" },
                { value: "openai/gpt-oss-20b", label: "openai/gpt-oss-20b" },
                { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "meta-llama/llama-4-scout-17b-16e-instruct" },
                { value: "moonshotai/kimi-k2-instruct", label: "moonshotai/kimi-k2-instruct" }
            ]
        };

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

        // Save preferences on change
        document.getElementById('tone-select').addEventListener('change', () => this.savePreferences());
        document.getElementById('model-select').addEventListener('change', () => this.savePreferences());

        // New: provider select change updates models and saves
        document.getElementById('provider-select').addEventListener('change', () => {
            this.savePreferences();
            this.updateModelOptions();
        });
    }

    updateModelOptions() {
        const provider = document.getElementById('provider-select').value;
        const modelSelect = document.getElementById('model-select');

        // Clear current options
        modelSelect.innerHTML = '';

        // Add models of the selected provider
        this.modelsByProvider[provider].forEach(model => {
            const option = document.createElement('option');
            option.value = model.value;
            option.textContent = model.label;
            modelSelect.appendChild(option);
        });

        // Select first model by default
        modelSelect.value = this.modelsByProvider[provider][0].value;
    }

    async loadSavedData() {
        try {
            let result = {};
            for (let i = 0; i < 10; i++) {
                result = await chrome.storage.local.get(['preferences', 'lastComment', 'currentPostContent']);
                if (result.currentPostContent) break;
                await new Promise(res => setTimeout(res, 100));
            }

            if (result.preferences) {
                document.getElementById('tone-select').value = result.preferences.tone || 'professional';
                document.getElementById('provider-select').value = result.preferences.provider || 'openai';

                // Update models dropdown based on provider
                this.updateModelOptions();

                // Set saved model if it exists in that provider's list
                const provider = document.getElementById('provider-select').value;
                const savedModel = result.preferences.model;
                if (savedModel && this.modelsByProvider[provider].some(m => m.value === savedModel)) {
                    document.getElementById('model-select').value = savedModel;
                }
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
                provider: document.getElementById('provider-select').value,
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
        const provider = document.getElementById('provider-select').value;
        const model = document.getElementById('model-select').value;
        const hint = document.getElementById('hint-input').value.trim();

        if (!postContent) {
            this.showStatus('Please enter post content or get it from the page first', 'error');
            return;
        }

        this.setGeneratingState(true);
        this.showStatus('Generating AI comment...', 'info');

        try {
            // Send message to background script with provider info
            const response = await chrome.runtime.sendMessage({
                action: 'generateComment',
                data: {
                    postCaption: postContent,
                    tone: tone,
                    provider: provider,
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
            this.fallbackCopy(commentText);
        } catch (error) {
            console.error('Error copying comment:', error);
            this.showStatus('Error copying comment', 'error');
        }
    }

    fallbackCopy(text) {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (successful) {
                this.showStatus('Comment copied to clipboard!', 'success');
            } else {
                throw new Error('Fallback copy command failed');
            }
        } catch (error) {
            this.showStatus('Error copying comment', 'error');
        }
    }

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

        if (type !== 'error') {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }
}

// Initialize extension when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LinkedInAIExtension();
});
