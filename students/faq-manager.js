const FAQManager = {
    currentCategory: 'all',
    faqs: [],
    activeFaqId: null,

    async init() {
        this.setupEventListeners();
        await this.loadFaqs();
    },

    setupEventListeners() {
        document.querySelectorAll('.faq-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Filter button clicked:', btn.dataset.category);
                document.querySelectorAll('.faq-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCategory = btn.dataset.category;
                console.log('Current category set to:', this.currentCategory);
                this.loadFaqs();
            });
        });

        const faqNav = document.querySelector('a[href="#faq"]');
        if (faqNav) {
            faqNav.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('faq').scrollIntoView({ behavior: 'smooth' });
            });
        }
    },

    async loadFaqs() {
        const faqList = document.getElementById('faqList');
        
        if (!faqList) {
            console.error('faqList element not found');
            return;
        }

        faqList.innerHTML = '<div class="faq-loading" id="faqLoading"><p>Loading FAQs...</p></div>';
        
        const faqLoading = document.getElementById('faqLoading');
        const faqNoResults = document.getElementById('faqNoResults');

        try {
            const params = new URLSearchParams();
            params.append('action', 'get-all');
            params.append('category', this.currentCategory);
            params.append('source', 'smart');

            console.log('Loading FAQs with category:', this.currentCategory, 'source: smart');
            const response = await fetch(`../api/faq.php?${params}`);
            const result = await response.json();

            console.log('FAQ API Response:', result);

            if (!result.success || !result.data || result.data.length === 0) {
                console.warn('No FAQs found for category:', this.currentCategory);
                faqList.innerHTML = '';
                if (faqNoResults) {
                    faqNoResults.style.display = 'block';
                }
                return;
            }

            this.faqs = result.data;
            this.renderFaqs();
            if (faqNoResults) {
                faqNoResults.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading FAQs:', error);
            faqList.innerHTML = '';
            if (faqNoResults) {
                faqNoResults.style.display = 'block';
            }
        }
    },

    renderFaqs() {
        const faqList = document.getElementById('faqList');
        
        if (!faqList) {
            console.error('faqList element not found');
            return;
        }
        
        faqList.innerHTML = '';

        this.faqs.forEach(faq => {
            const faqItem = document.createElement('div');
            faqItem.className = 'faq-item';
            faqItem.dataset.faqId = faq.id;

            const categoryLabel = faq.category ? `<span class="faq-category">${this.getCategoryLabel(faq.category)}</span>` : '';

            const viewCountStr = faq.view_count ? `<span class="faq-stat">${faq.view_count} ${faq.view_count === 1 ? 'view' : 'views'}</span>` : '';
            const helpfulCountStr = faq.helpful_count > 0 ? `<span class="faq-helpful-count" title="Helpful votes">${faq.helpful_count} helpful</span>` : '';
            const unhelpfulCountStr = faq.unhelpful_count > 0 ? `<span class="faq-unhelpful-count" title="Unhelpful votes">${faq.unhelpful_count} unhelpful</span>` : '';

            faqItem.innerHTML = `
                <button class="faq-header-btn" data-faq-id="${faq.id}">
                    <div style="flex: 1; text-align: left;">
                        ${categoryLabel}
                        <p class="faq-question">${this.escapeHtml(faq.question_text)}</p>
                        <div class="faq-stats">
                            ${viewCountStr}
                            ${helpfulCountStr}
                            ${unhelpfulCountStr}
                        </div>
                    </div>
                    <svg class="faq-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="faq-content">
                    <div class="faq-answer">
                        ${this.formatAnswer(faq.answer_text)}
                    </div>
                    <div class="faq-footer">
                        <button class="faq-action-btn helpful" data-faq-id="${faq.id}" data-action="helpful" title="Mark as helpful">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 10h4.764a2 2 0 0 1 1.789 2.894l-3.646 7.769A2 2 0 0 1 14.763 23H7m0 0a8 8 0 0 1-8-8v-5a8 8 0 0 1 8-8m0 0v8m0-8h8"></path>
                            </svg>
                            <span>Helpful</span>
                        </button>
                        <button class="faq-action-btn unhelpful" data-faq-id="${faq.id}" data-action="unhelpful" title="Mark as unhelpful">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10 14H5.236a2 2 0 0 1-1.789-2.894l3.646-7.769A2 2 0 0 1 9.237 1H17m0 0a8 8 0 0 1 8 8v5a8 8 0 0 1-8 8m0 0v-8m0 8H9"></path>
                            </svg>
                            <span>Unhelpful</span>
                        </button>
                    </div>
                </div>
            `;

            faqList.appendChild(faqItem);
        });

        this.attachFaqEventListeners();
    },

    attachFaqEventListeners() {
        document.querySelectorAll('.faq-header-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const faqId = btn.dataset.faqId;
                const faqItem = btn.closest('.faq-item');

                document.querySelectorAll('.faq-item.active').forEach(item => {
                    if (item.dataset.faqId !== faqId) {
                        item.classList.remove('active');
                    }
                });

                faqItem.classList.toggle('active');

                if (faqItem.classList.contains('active')) {
                    this.trackFaqView(faqId);
                }
            });
        });

        document.querySelectorAll('.faq-action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const faqId = btn.dataset.faqId;
                const action = btn.dataset.action;
                await this.trackFaqFeedback(faqId, action);

                btn.style.opacity = '0.6';
                setTimeout(() => {
                    btn.style.opacity = '1';
                }, 300);
            });
        });
    },

    async trackFaqView(faqId) {
        try {
            await fetch('../api/faq.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'track-view',
                    faq_id: faqId
                })
            });
        } catch (error) {
            console.error('Error tracking FAQ view:', error);
        }
    },

    async trackFaqFeedback(faqId, feedback) {
        try {
            const voteType = feedback === 'helpful' ? 'helpful' : 'unhelpful';
            
            const response = await fetch('../api/faq.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'track-vote',
                    faq_id: faqId,
                    vote: voteType
                })
            });

            const result = await response.json();
            
            if (result.success) {
                const message = feedback === 'helpful' 
                    ? 'Thank you! We\'re glad this FAQ was helpful.' 
                    : 'Thank you for the feedback. We\'ll work on improving this FAQ.';
                
                this.showNotification(message, 'success');
                
                setTimeout(() => {
                    this.loadFaqs();
                }, 1500);
            } else {
                const errorMsg = result.error || 'Failed to submit your vote';
                if (errorMsg.includes('Please login')) {
                    this.showNotification('Please login to vote on FAQs', 'warning');
                } else {
                    this.showNotification(errorMsg, 'error');
                }
            }
        } catch (error) {
            console.error('Error tracking FAQ feedback:', error);
            this.showNotification('Error submitting vote. Please try again.', 'error');
        }
    },

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `faq-notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#ff9800'};
            color: white;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    getCategoryLabel(category) {
        const labels = {
            'academic': 'Academic',
            'technical': 'Technical',
            'account': 'Account',
            'other': 'Other'
        };
        return labels[category] || category;
    },

    formatAnswer(text) {
        return text
            .split('\n')
            .map(line => {
                if (line.startsWith('• ') || line.startsWith('- ')) {
                    return `<li>${this.escapeHtml(line.substring(2))}</li>`;
                }
                return `<p>${this.escapeHtml(line)}</p>`;
            })
            .join('');
    },

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('faqList')) {
        FAQManager.init();
    }
});
