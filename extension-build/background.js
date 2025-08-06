// Background script for LinkedIn AI Comment Generator Extension

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('LinkedIn AI Comment Generator Extension installed');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateComment') {
        generateComment(request.data)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
    }
});

// Generate proper UUID v4 format
function generateUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function getOrCreateUserId() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['userId'], (result) => {
            if (result.userId) {
                // Check if existing userId is in proper UUID format
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(result.userId)) {
                    resolve(result.userId);
                } else {
                    // Replace old format with new UUID
                    const userId = generateUUIDv4();
                    chrome.storage.local.set({ userId }, () => {
                        resolve(userId);
                    });
                }
            } else {
                const userId = generateUUIDv4(); // ✅ now generates a proper UUID format
                chrome.storage.local.set({ userId }, () => {
                    resolve(userId);
                });
            }
        });
    });
}

// Function to generate comment using Supabase Edge Function
async function generateComment(data) {
    try {
        // Generate a proper UUID for tracking
        const userId = await getOrCreateUserId();
        
        const response = await fetch('https://vnwosirrztdhsefobxpm.supabase.co/functions/v1/generate-comment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZud29zaXJyenRkaHNlZm9ieHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyMzU3OTQsImV4cCI6MjA2OTgxMTc5NH0.WeI2Oy_eaXQ-G80EcZhdRiWj49gC2sGNVVuj9xCr9zo`
            },
            body: JSON.stringify({
                ...data,
                userId: userId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }

        return {
            success: true,
            comment: result.generatedComment
        };
    } catch (error) {
        console.error('Error calling Supabase function:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('linkedin.com')) {
        // Optional: Could inject additional scripts or perform setup here
        console.log('LinkedIn page loaded:', tab.url);
    }
});