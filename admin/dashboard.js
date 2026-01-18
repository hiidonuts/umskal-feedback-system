let feedbackData = [];
let faqData = [];
let allFeedbackData = [];
let allFAQData = [];

let feedbackCategoryChart = null;
let faqPerformanceChart = null;
let feedbackTrendChart = null;
let chatbotLatencyChart = null;

function safeDestroyChart(chartVar, canvasId) {
    try {
        if (chartVar) {
            try { 
                chartVar.destroy(); 
            } catch(e) { 
                console.warn(`Could not destroy ${canvasId} variable:`, e); 
            }
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        
        if (typeof Chart !== 'undefined') {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                try { 
                    existingChart.destroy(); 
                } catch(e) { 
                    console.warn(`Could not destroy existing ${canvasId} from registry:`, e); 
                }
            }
        }
        
        const parent = canvas.parentNode;
        const newCanvas = document.createElement('canvas');
        newCanvas.id = canvasId;
        newCanvas.style.maxHeight = '400px';
        parent.replaceChild(newCanvas, canvas);
        
        return document.getElementById(canvasId);
    } catch(e) {
        console.error(`Error destroying chart ${canvasId}:`, e);
        return null;
    }
}

function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || '✓'}</div>
        <div class="toast-content">${message}</div>
        <button class="toast-close" aria-label="Close notification">×</button>
    `;
    
    container.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
        toast.classList.add('removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    };
    
    closeBtn.addEventListener('click', removeToast);
    
    if (duration > 0) {
        setTimeout(removeToast, duration);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeProfile();
    loadDashboardData();
    attachEventListeners();
    setupCharts();
});

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');
            const target = '#' + sectionId;
            
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.dashboard-section').forEach(section => {
                section.classList.remove('active');
            });
            
            const targetSection = document.querySelector(target);
            if (targetSection) {
                targetSection.classList.add('active');
                
                if (target === '#feedback') {
                    loadFeedbackData();
                } else if (target === '#faqs') {
                    loadFAQData();
                }
            }
        });
    });
    
    const firstItem = navItems[0];
    if (firstItem) {
        firstItem.classList.add('active');
    }
}

function initializeProfile() {
    const profileBtn = document.getElementById('sidebarAdminProfileBtn');
    const logoutBtn = document.getElementById('navLogout');
    
    if (profileBtn) {
        profileBtn.addEventListener('click', toggleAdminProfileSidebar);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fetch('../api/session.php?action=logout', {
                credentials: 'include'
            })
                .then(() => {
                    window.location.href = '../admin/admin_login.html';
                })
                .catch(() => {
                    window.location.href = '../admin/admin_login.html';
                });
        });
    }

    const navSettings = document.getElementById('navSettings');
    
    if (navSettings) {
        navSettings.addEventListener('click', (e) => {
            e.preventDefault();
            toggleAdminProfileSidebar();
        });
    }

    initAdminProfileSidebar();
    loadAdminProfile();
}

function exportStatistics() {
    Promise.all([
        fetch('../api/feedback.php?action=get-stats', { credentials: 'include' }).then(r => r.json()),
        fetch('../api/faq.php?action=get-stats', { credentials: 'include' }).then(r => r.json()),
        fetch('../api/feedback.php?action=get-all', { credentials: 'include' }).then(r => r.json()),
        fetch('../api/faq.php?action=get-all', { credentials: 'include' }).then(r => r.json())
    ])
    .then(([feedbackStats, faqStats, feedbackData, faqData]) => {
        const timestamp = new Date().toLocaleString();

        let csvContent = 'ADMIN SYSTEM STATISTICS REPORT\n';
        csvContent += `Generated: ${timestamp}\n\n`;
  
        csvContent += '=== FEEDBACK STATISTICS ===\n';
        csvContent += `Total Feedbacks,${feedbackStats.data?.total || 0}\n`;
        csvContent += `This Month,${feedbackStats.data?.this_month || 0}\n`;
        csvContent += `Pending Reviews,${feedbackStats.data?.pending || 0}\n`;
        csvContent += `Resolution Rate,${(feedbackStats.data?.resolution_rate || 0).toFixed(1)}%\n\n`;

        csvContent += '=== FAQ STATISTICS ===\n';
        csvContent += `Total FAQs,${faqStats.data?.total || 0}\n`;
        csvContent += `This Month,${faqStats.data?.this_month || 0}\n`;
        csvContent += `Total Views,${faqStats.data?.total_views || 0}\n`;
        csvContent += `Total Helpful,${faqStats.data?.total_helpful || 0}\n`;
        csvContent += `Total Unhelpful,${faqStats.data?.total_unhelpful || 0}\n\n`;

        if (feedbackData.data && feedbackData.data.length > 0) {
            csvContent += '=== FEEDBACK LIST ===\n';
            csvContent += 'ID,Title,Category,Status,Student,Date\n';
            feedbackData.data.forEach(f => {
                csvContent += `${f.id},"${f.title || f.content.substring(0, 50)}","${f.category}","${f.status}","${f.student_name || 'Anonymous'}","${f.created_at}"\n`;
            });
            csvContent += '\n';
        }

        if (faqData.data && faqData.data.length > 0) {
            csvContent += '=== FAQ LIST ===\n';
            csvContent += 'ID,Question,Category,Views,Helpful,Unhelpful\n';
            faqData.data.forEach(f => {
                csvContent += `${f.id},"${f.question_text}","${f.category}",${f.view_count || 0},${f.helpful_count || 0},${f.unhelpful_count || 0}\n`;
            });
        }
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admin-statistics-${new Date().getTime()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Statistics exported successfully!', 'success');
    })
    .catch(err => {
        console.error('Error exporting statistics:', err);
        showToast('Error exporting statistics', 'error');
    });
}

function showSystemInformation() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const language = navigator.language;
    const onLine = navigator.onLine;
    const cookies = navigator.cookieEnabled;
    
    const info = `
| SYSTEM INFORMATION |

Browser Information:
- User Agent: ${userAgent}
- Platform: ${platform}
- Language: ${language}
- Cookies Enabled: ${cookies ? 'Yes' : 'No'}
- Online Status: ${onLine ? 'Online' : 'Offline'}

Current Time: ${new Date().toLocaleString()}
Page URL: ${window.location.href}

    `.trim();
    
    showToast(info, 'info');
}

function loadAdminProfile() {
    fetch('../api/session.php?action=get-admin', {
        credentials: 'include'
    })
        .then(res => {
            if (!res.ok) throw new Error('Network response was not ok');
            const ct = res.headers.get('content-type') || '';
            if (ct.indexOf('application/json') !== -1) {
                return res.json();
            }
            return res.text().then(t => {
                console.warn('Admin profile response not JSON:', t);
                throw new Error('Invalid JSON response for admin profile');
            });
        })
        .then(data => {
            if (data && data.success && data.admin) {
                const adminName = data.admin.full_name || 'Admin';
                const adminEmail = data.admin.email || '';
                const adminRole = data.admin.role || 'Admin';
                
                document.getElementById('sidebarAdminName').textContent = adminName;
                
                let profilePicUrl = data.admin.profile_picture_url || data.admin.profile_picture || 
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23d0d0d0"/%3E%3Ccircle cx="50" cy="35" r="15" fill="%23a0a0a0"/%3E%3Cellipse cx="50" cy="70" rx="20" ry="18" fill="%23a0a0a0"/%3E%3C/svg%3E';
                
                const sidebarPic = document.getElementById('sidebarAdminPic');
                if (sidebarPic) {
                    sidebarPic.src = profilePicUrl;
                }
            } else {
                setDefaultAdminProfilePic();
            }
        })
        .catch(err => {
            console.warn('Could not parse admin profile response, using default', err);
            setDefaultAdminProfilePic();
        });
}

function setDefaultAdminProfilePic() {
    const defaultPicUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23d0d0d0"/%3E%3Ccircle cx="50" cy="35" r="15" fill="%23a0a0a0"/%3E%3Cellipse cx="50" cy="70" rx="20" ry="18" fill="%23a0a0a0"/%3E%3C/svg%3E';
    document.getElementById('sidebarAdminName').textContent = 'Admin';
    document.getElementById('sidebarAdminPic').src = defaultPicUrl;
}

function attachEventListeners() {
    document.getElementById('feedbackCategoryFilter').addEventListener('change', filterFeedback);
    document.getElementById('feedbackStatusFilter').addEventListener('change', filterFeedback);
    document.getElementById('feedbackSortFilter').addEventListener('change', filterFeedback);
    document.getElementById('feedbackSearchInput').addEventListener('keyup', filterFeedback);
    document.getElementById('hideResolvedToggle').addEventListener('change', filterFeedback);
    
    document.getElementById('faqCategoryFilter').addEventListener('change', filterFAQs);

    document.getElementById('closeFeedbackModal').addEventListener('click', closeFeedbackModal);
    document.getElementById('feedbackDetailModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('feedbackDetailModal')) {
            closeFeedbackModal();
        }
    });
}

function updatePageLanguage(lang) {
    document.querySelectorAll('[data-en]').forEach(element => {
        element.textContent = element.getAttribute('data-en');
    });

    document.querySelectorAll('[data-en-placeholder]').forEach(element => {
        element.placeholder = element.getAttribute('data-en-placeholder');
    });
    
    localStorage.setItem('selectedLanguage', lang);
}

function loadDashboardData() {
    Promise.all([
        loadFeedbackStats(),
        loadFAQStats(),
        loadFeedbackTrend(),
        loadReminders()
    ]).then(() => {
        setupCharts();
    }).catch(err => console.error('Error loading dashboard data:', err));
}

function loadFeedbackStats() {
    return fetch('../api/feedback.php?action=get-stats', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data) {
                const stats = data.data;
                document.getElementById('totalFeedbacksCount').textContent = stats.total || 0;
                document.getElementById('feedbacksChangeText').textContent = `+${stats.this_month || 0} this month`;
                document.getElementById('pendingFeedbackCount').textContent = stats.pending || 0;

                const total = stats.total || 0;
                const resolved = stats.resolved || 0;
                const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
                document.getElementById('resolutionRateCount').textContent = resolutionRate + '%';
            } else {
                document.getElementById('totalFeedbacksCount').textContent = '0';
                document.getElementById('feedbacksChangeText').textContent = '+0 this month';
                document.getElementById('pendingFeedbackCount').textContent = '0';
                document.getElementById('resolutionRateCount').textContent = '0%';
            }
        })
        .catch(err => {
            console.error('Error loading feedback stats:', err);
            document.getElementById('totalFeedbacksCount').textContent = '0';
            document.getElementById('feedbacksChangeText').textContent = '+0 this month';
            document.getElementById('pendingFeedbackCount').textContent = '0';
            document.getElementById('resolutionRateCount').textContent = '0%';
        });
}

function loadFAQStats() {
    return fetch('../api/faq.php?action=get-stats', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data) {
                const stats = data.data;
                document.getElementById('totalFAQsCount').textContent = stats.total || 0;
                document.getElementById('totalViewsFAQCount').textContent = stats.total_views || 0;
                document.getElementById('totalHelpfulCount').textContent = stats.total_helpful || 0;
                document.getElementById('totalUnhelpfulCount').textContent = stats.total_unhelpful || 0;
            } else {
                document.getElementById('totalFAQsCount').textContent = '0';
                document.getElementById('totalViewsFAQCount').textContent = '0';
                document.getElementById('totalHelpfulCount').textContent = '0';
                document.getElementById('totalUnhelpfulCount').textContent = '0';
            }
        })
        .catch(err => {
            console.error('Error loading FAQ stats:', err);
            document.getElementById('totalFAQsCount').textContent = '0';
            document.getElementById('totalViewsFAQCount').textContent = '0';
            document.getElementById('totalHelpfulCount').textContent = '0';
            document.getElementById('totalUnhelpfulCount').textContent = '0';
        });
}

function loadFeedbackTrend() {
    return fetch('../api/feedback.php?action=get-trend', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
                window.feedbackTrendData = data.data;
            } else {
                window.feedbackTrendData = [];
            }
        })
        .catch(err => {
            console.error('Error loading feedback trend:', err);
            window.feedbackTrendData = [];
        });
}

function loadReminders() {
    return fetch('../api/feedback.php?action=get-pending', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            const remindersList = document.getElementById('remindersList');
            if (!remindersList) return;
            
            remindersList.innerHTML = '';
            
            let itemsAdded = 0;
            
            try {
                const customReminders = JSON.parse(localStorage.getItem('adminReminders') || '[]');
                customReminders.forEach(customReminder => {
                    const reminderItem = document.createElement('div');
                    reminderItem.className = 'reminder-item';
                    reminderItem.setAttribute('data-reminder-id', customReminder.id);
                    
                    const createdDate = new Date(customReminder.createdAt);
                    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                    const formattedDate = createdDate.toLocaleDateString('en-US', options);
                    
                    reminderItem.innerHTML = `
                        <div class="reminder-content">
                            <button class="reminder-checkbox" title="Mark as complete" aria-label="Mark reminder as complete">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                </svg>
                            </button>
                            <div class="reminder-details">
                                <div class="reminder-header">
                                    <div class="reminder-time">${formattedDate}</div>
                                </div>
                                <div class="reminder-title">${customReminder.title}</div>
                            </div>
                        </div>
                    `;
                    
                    const checkboxBtn = reminderItem.querySelector('.reminder-checkbox');
                    const reminderId = customReminder.id;
                    checkboxBtn.addEventListener('click', function() {
                        reminderItem.style.opacity = '0.5';
                        reminderItem.style.textDecoration = 'line-through';
                        checkboxBtn.innerHTML = `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="16 12 12 8 8 12" style="stroke-linecap:round;stroke-linejoin:round;"></polyline>
                                <line x1="12" y1="16" x2="12" y2="8" style="stroke-linecap:round;"></line>
                            </svg>
                        `;
                        setTimeout(() => {
                            const reminders = JSON.parse(localStorage.getItem('adminReminders') || '[]');
                            const updatedReminders = reminders.filter(r => r.id !== reminderId);
                            localStorage.setItem('adminReminders', JSON.stringify(updatedReminders));
                            
                            reminderItem.remove();

                            if (remindersList.children.length === 0) {
                                remindersList.innerHTML = '<p class="no-reminders-text">No reminders. You\'re all caught up!</p>';
                            }
                        }, 300);
                    });
                    
                    remindersList.appendChild(reminderItem);
                    itemsAdded++;
                });
            } catch (e) {
                console.warn('Error loading custom reminders from localStorage:', e);
            }

            if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
                data.data.slice(0, Math.max(1, 5 - itemsAdded)).forEach(feedback => {
                    const reminderItem = document.createElement('div');
                    reminderItem.className = 'reminder-item';
                    reminderItem.setAttribute('data-reminder-id', 'feedback-' + feedback.id);
                    
                    const createdDate = new Date(feedback.created_at);
                    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
                    const formattedDate = createdDate.toLocaleDateString('en-US', options);
                    
                    reminderItem.innerHTML = `
                        <div class="reminder-content">
                            <button class="reminder-checkbox" title="Mark as complete" aria-label="Mark reminder as complete">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                </svg>
                            </button>
                            <div class="reminder-details">
                                <div class="reminder-header">
                                    <div class="reminder-time">${formattedDate}</div>
                                </div>
                                <div class="reminder-title">${feedback.title || 'Pending Review'}</div>
                            </div>
                        </div>
                    `;
                    
                    const checkboxBtn = reminderItem.querySelector('.reminder-checkbox');
                    checkboxBtn.addEventListener('click', function() {
                        reminderItem.style.opacity = '0.5';
                        reminderItem.style.textDecoration = 'line-through';
                        checkboxBtn.innerHTML = `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="16 12 12 8 8 12" style="stroke-linecap:round;stroke-linejoin:round;"></polyline>
                                <line x1="12" y1="16" x2="12" y2="8" style="stroke-linecap:round;"></line>
                            </svg>
                        `;
                        setTimeout(() => {
                            reminderItem.remove();
                            if (remindersList.children.length === 0) {
                                remindersList.innerHTML = '<p class="no-reminders-text">No reminders. You\'re all caught up!</p>';
                            }
                        }, 300);
                    });
                    
                    remindersList.appendChild(reminderItem);
                    itemsAdded++;
                });
            }
            
            if (itemsAdded === 0) {
                remindersList.innerHTML = '<p class="no-reminders-text">No reminders. You\'re all caught up!</p>';
            }
            
            const btnNewReminder = document.getElementById('btnNewReminder');
            if (btnNewReminder) {
                btnNewReminder.addEventListener('click', showAddReminderModal);
            }
        })
        .catch(err => {
            console.error('Error loading reminders:', err);
            const remindersList = document.getElementById('remindersList');
            if (remindersList) {
                remindersList.innerHTML = `
                    <div class="reminder-item" data-reminder-id="default-1">
                        <div class="reminder-content">
                            <button class="reminder-checkbox" title="Mark as complete" aria-label="Mark reminder as complete">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                </svg>
                            </button>
                            <div class="reminder-details">
                                <div class="reminder-header">
                                    <div class="reminder-time">Today 03:00 pm</div>
                                </div>
                                <div class="reminder-title">Review pending feedback</div>
                            </div>
                        </div>
                    </div>
                    <div class="reminder-item" data-reminder-id="default-2">
                        <div class="reminder-content">
                            <button class="reminder-checkbox" title="Mark as complete" aria-label="Mark reminder as complete">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                </svg>
                            </button>
                            <div class="reminder-details">
                                <div class="reminder-header">
                                    <div class="reminder-time">Due Dec 24, 2024</div>
                                </div>
                                <div class="reminder-title">Update FAQ Categories</div>
                            </div>
                        </div>
                    </div>
                `;
                
                document.querySelectorAll('.reminder-checkbox').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const reminderItem = btn.closest('.reminder-item');
                        reminderItem.style.opacity = '0.5';
                        reminderItem.style.textDecoration = 'line-through';
                        btn.innerHTML = `
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="16 12 12 8 8 12" style="stroke-linecap:round;stroke-linejoin:round;"></polyline>
                                <line x1="12" y1="16" x2="12" y2="8" style="stroke-linecap:round;"></line>
                            </svg>
                        `;
                        setTimeout(() => {
                            reminderItem.remove();
                            if (remindersList.children.length === 0) {
                                remindersList.innerHTML = '<p class="no-reminders-text">No reminders. You\'re all caught up!</p>';
                            }
                        }, 300);
                    });
                });
            }
            
            const btnNewReminder = document.getElementById('btnNewReminder');
            if (btnNewReminder) {
                btnNewReminder.addEventListener('click', showAddReminderModal);
            }
        });
}

function loadFeedbackData() {
    const container = document.getElementById('feedbackAdminList');
    container.innerHTML = '<div class="loading-state"><p>Loading feedback...</p></div>';
    
    fetch('../api/feedback.php?action=get-all', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data) {
                allFeedbackData = data.data;
                filterFeedback();
            } else {
                container.innerHTML = '<div class="no-data-state"><h3>No feedback found</h3></div>';
            }
        })
        .catch(err => {
            console.error('Error loading feedback:', err);
            container.innerHTML = '<div class="no-data-state"><h3>Error loading feedback</h3></div>';
        });
}

function loadFAQData() {
    const container = document.getElementById('faqAdminList');
    container.innerHTML = '<div class="loading-state"><p>Loading FAQs...</p></div>';
    
    fetch('../api/faq.php?action=admin-get-all', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data) {
                allFAQData = data.data;
                filterFAQs();
                updateFAQStats();
            } else {
                container.innerHTML = '<div class="no-data-state"><h3>No FAQs found</h3></div>';
            }
        })
        .catch(err => {
            console.error('Error loading FAQs:', err);
            container.innerHTML = '<div class="no-data-state"><h3>Error loading FAQs</h3></div>';
        });
}

function updateFAQStats() {
    const totalViews = allFAQData.reduce((sum, faq) => sum + (faq.view_count || 0), 0);
    const totalHelpful = allFAQData.reduce((sum, faq) => sum + (faq.helpful_count || 0), 0);
    const totalUnhelpful = allFAQData.reduce((sum, faq) => sum + (faq.unhelpful_count || 0), 0);
    
    document.getElementById('totalViewsFAQCount').textContent = totalViews;
    document.getElementById('totalHelpfulCount').textContent = totalHelpful;
    document.getElementById('totalUnhelpfulCount').textContent = totalUnhelpful;
}

function filterFeedback() {
    const category = document.getElementById('feedbackCategoryFilter').value;
    const status = document.getElementById('feedbackStatusFilter').value;
    const sortBy = document.getElementById('feedbackSortFilter').value;
    const searchTerm = document.getElementById('feedbackSearchInput').value.toLowerCase();
    const hideResolved = document.getElementById('hideResolvedToggle').checked;
    
    let filtered = allFeedbackData.filter(feedback => {
        const categoryMatch = category === 'all' || feedback.category === category;
        const statusMatch = status === 'all' || feedback.status === status;
        const searchMatch = !searchTerm || 
            feedback.title.toLowerCase().includes(searchTerm) ||
            feedback.content.toLowerCase().includes(searchTerm) ||
            feedback.reference.includes(searchTerm);
        const resolvedMatch = !hideResolved || feedback.status !== 'resolved';
        
        return categoryMatch && statusMatch && searchMatch && resolvedMatch;
    });
    
    if (sortBy === 'oldest') {
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortBy === 'status') {
        const statusOrder = { 'open': 1, 'in-progress': 2, 'resolved': 3, 'closed': 4 };
        filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    } else {
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    displayFeedback(filtered);
}

function filterFAQs() {
    const category = document.getElementById('faqCategoryFilter').value;
    
    let filtered = allFAQData;
    if (category !== 'all') {
        filtered = allFAQData.filter(faq => faq.category === category);
    }
    
    displayFAQs(filtered);
}

function displayFeedback(feedbackList) {
    const container = document.getElementById('feedbackAdminList');
    
    if (feedbackList.length === 0) {
        container.innerHTML = '<div class="no-data-state"><h3>No feedback found</h3></div>';
        return;
    }
    
    container.innerHTML = feedbackList.map(feedback => `
        <div class="feedback-item ${feedback.status}">
            <div class="feedback-item-header">
                <div class="feedback-item-title">${escapeHtml(feedback.title || feedback.content.substring(0, 50))}</div>
                <div class="feedback-item-reference">${feedback.reference}</div>
            </div>
            <div class="feedback-item-meta">
                <span class="feedback-category">${feedback.category}</span>
                <span class="feedback-status ${feedback.status}">${feedback.status}</span>
                <div class="meta-item">
                    <strong>From:</strong> ${escapeHtml(feedback.student_name || 'Anonymous')}
                </div>
            </div>
            <div class="feedback-item-content">
                ${escapeHtml(feedback.content.substring(0, 150))}${feedback.content.length > 150 ? '...' : ''}
            </div>
            <div class="feedback-item-footer">
                <span class="feedback-date">${formatDate(feedback.created_at)}</span>
                <button class="view-details-btn" onclick="showFeedbackDetail(${feedback.id})">View Details</button>
            </div>
        </div>
    `).join('');
}

function displayFAQs(faqList) {
    const container = document.getElementById('faqAdminList');
    
    if (faqList.length === 0) {
        container.innerHTML = '<div class="no-data-state"><h3>No FAQs found</h3></div>';
        return;
    }
    
    container.innerHTML = faqList.map(faq => {
        const isVisible = faq.is_visible !== 0;
        const isSmartFAQ = faq.source === 'smart' || faq.id >= 1000;
        
        return `
        <div class="faq-admin-item ${!isVisible ? 'hidden-faq' : ''}" data-faq-id="${faq.id}">
            <div class="faq-admin-header">
                <div class="faq-admin-info">
                    <div class="faq-admin-category">${escapeHtml(faq.category)}</div>
                    <div class="faq-admin-question">${escapeHtml(faq.question_text)}</div>
                    <div class="faq-admin-answer">${escapeHtml(faq.answer_text)}</div>
                    <div class="faq-admin-stats">
                        <div class="faq-admin-stat">
                            ● <span>${faq.view_count || 0} views</span>
                        </div>
                        <div class="faq-admin-stat">
                            ● <span style="color: #059669;">${faq.helpful_count || 0} helpful</span>
                        </div>
                        <div class="faq-admin-stat">
                            ● <span style="color: #dc2626;">${faq.unhelpful_count || 0} unhelpful</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="faq-admin-actions">
                <button class="faq-admin-btn faq-admin-btn-toggle ${!isVisible ? 'hidden' : ''}" 
                        onclick="toggleFAQVisibility(${faq.id}, ${isVisible ? 0 : 1})"
                        title="${isVisible ? 'Hide from students' : 'Show to students'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${isVisible ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>' : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'}
                    </svg>
                    <span>${isVisible ? 'Hide' : 'Show'}</span>
                </button>
                <button class="faq-admin-btn faq-admin-btn-delete" 
                        onclick="deleteFAQ(${faq.id})"
                        title="Delete this FAQ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                    <span>Delete</span>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

function deleteFAQ(faqId) {
    if (!confirm('Are you sure you want to delete this FAQ? This action cannot be undone.')) {
        return;
    }
    
    const formData = new FormData();
    formData.append('id', faqId);
    
    fetch('../api/faq.php?action=admin-delete', {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('FAQ deleted successfully', 'success');
            allFAQData = allFAQData.filter(f => f.id !== faqId);
            filterFAQs();
            updateFAQStats();
        } else {
            showToast('Error deleting FAQ: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(err => {
        console.error('Error deleting FAQ:', err);
        showToast('Error deleting FAQ', 'error');
    });
}

function toggleFAQVisibility(faqId, newVisibility) {
    console.log(`Toggling FAQ ${faqId} to visibility: ${newVisibility}`);
    
    const formData = new FormData();
    formData.append('id', faqId);
    formData.append('is_visible', newVisibility);
    
    fetch('../api/faq.php?action=admin-toggle-visibility', {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        console.log('Toggle response:', data);
        if (data.success) {
            showToast(newVisibility ? 'FAQ is now visible to students' : 'FAQ is now hidden from students', 'success');
            const faq = allFAQData.find(f => f.id === faqId);
            if (faq) {
                faq.is_visible = newVisibility;
                console.log(`Updated FAQ ${faqId} in allFAQData, new is_visible: ${faq.is_visible}`);
            }
            filterFAQs();
        } else {
            showToast('Error updating FAQ visibility: ' + (data.error || 'Unknown error'), 'error');
        }
    })
    .catch(err => {
        console.error('Error updating FAQ visibility:', err);
        showToast('Error updating FAQ visibility', 'error');
    });
}

function showFeedbackDetail(feedbackId) {
    const feedback = allFeedbackData.find(f => f.id === feedbackId);
    if (!feedback) return;
    
    const modal = document.getElementById('feedbackDetailModal');
    const content = document.getElementById('feedbackDetailContent');
    
    content.innerHTML = `
        <h2 class="feedback-detail-title">${escapeHtml(feedback.title || 'Feedback Details')}</h2>
        
        <div class="feedback-detail-meta">
            <div class="detail-item">
                <span class="detail-label">Reference</span>
                <span class="detail-value">${feedback.reference}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Category</span>
                <span class="detail-value">${feedback.category}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Status</span>
                <span class="detail-value feedback-status ${feedback.status}">${feedback.status}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">From</span>
                <span class="detail-value">${escapeHtml(feedback.student_name || 'Anonymous')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Email</span>
                <span class="detail-value">${escapeHtml(feedback.email || 'N/A')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Submitted</span>
                <span class="detail-value">${formatDate(feedback.created_at)}</span>
            </div>
        </div>
        
        <div>
            <h3 style="color: #002147; margin-bottom: 10px;">Message</h3>
            <div class="feedback-detail-content">
                ${escapeHtml(feedback.content)}
            </div>
        </div>
        
        ${feedback.admin_response ? `
            <div>
                <h3 style="color: #002147; margin-bottom: 10px;">Admin Response</h3>
                <div class="feedback-detail-content" style="background: rgba(122, 20, 35, 0.05);">
                    ${escapeHtml(feedback.admin_response)}
                </div>
            </div>
        ` : ''}
        
        ${feedback.status !== 'resolved' ? `
            <div class="resolve-feedback-section">
                <h3 style="color: #002147; margin-bottom: 10px;">Resolve This Feedback</h3>
                <textarea id="resolveMessage" class="resolve-textarea" placeholder="Enter your resolution message..."></textarea>
                <div class="resolve-actions">
                    <button class="btn-resolve" onclick="submitFeedbackResolution(${feedback.id})">Send Resolution</button>
                    <button class="btn-cancel" onclick="closeFeedbackModal()">Cancel</button>
                </div>
            </div>
        ` : ''}
    `;
    
    modal.classList.add('show');
}

function closeFeedbackModal() {
    document.getElementById('feedbackDetailModal').classList.remove('show');
}

function setupCharts() {
    if (typeof Chart === 'undefined') return;

    setTimeout(() => {
        setupFeedbackCategoryChart();
        setupFAQPerformanceChart();
        setupFeedbackTrendChart();
        setupChatbotLatencyChart();
    }, 100);
}

function setupFeedbackCategoryChart() {
    const ctx = safeDestroyChart(feedbackCategoryChart, 'feedbackCategoryChart');
    if (!ctx) return;

    fetch('../api/feedback.php?action=get-category-stats', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data) {
                const categories = data.data.map(item => item.category);
                const counts = data.data.map(item => item.count);
                
                feedbackCategoryChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: categories,
                        datasets: [{
                            data: counts,
                            backgroundColor: [
                                'rgba(0, 33, 71, 0.8)',
                                'rgba(122, 20, 35, 0.8)',
                                'rgba(59, 130, 246, 0.8)',
                                'rgba(16, 185, 129, 0.8)',
                                'rgba(245, 158, 11, 0.8)'
                            ],
                            borderColor: [
                                '#002147',
                                '#7a1423',
                                '#3b82f6',
                                '#10b981',
                                '#f59e0b'
                            ],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            } else {
                console.warn('No category stats data received');
            }
        })
        .catch(err => {
            console.error('Error setting up feedback category chart:', err);
        });
}

function setupFAQPerformanceChart() {
    const ctx = safeDestroyChart(faqPerformanceChart, 'faqPerformanceChart');
    if (!ctx) return;
    
    ctx.width = ctx.width;
    
    fetch('../api/faq.php?action=get-performance-stats', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data && data.data.length > 0) {
                const topFAQs = data.data.slice(0, 5);
                const labels = topFAQs.map(item => item.question_text.substring(0, 30) + '...');
                const views = topFAQs.map(item => item.view_count);
                const helpful = topFAQs.map(item => item.helpful_count);
                
                faqPerformanceChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Views',
                                data: views,
                                backgroundColor: 'rgba(0, 33, 71, 0.6)',
                                borderColor: '#002147',
                                borderWidth: 1
                            },
                            {
                                label: 'Helpful',
                                data: helpful,
                                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                                borderColor: '#10b981',
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            }
                        }
                    }
                });
            } else {
                console.warn('No FAQ performance stats data received');
            }
        })
        .catch(err => {
            console.error('Error setting up FAQ performance chart:', err);
        });
}

function setupFeedbackTrendChart() {
    const ctx = safeDestroyChart(feedbackTrendChart, 'feedbackTrendChart');
    if (!ctx) return;
    
    fetch('../api/feedback.php?action=get-trend', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.data && Array.isArray(data.data) && data.data.length > 0) {
                const dates = data.data.map(item => item.date);
                const counts = data.data.map(item => item.count);
                
                feedbackTrendChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: dates,
                        datasets: [{
                            label: 'Feedback Submissions',
                            data: counts,
                            borderColor: '#7a1423',
                            backgroundColor: 'rgba(122, 20, 35, 0.1)',
                            borderWidth: 3,
                            fill: true,
                            pointRadius: 5,
                            pointBackgroundColor: '#7a1423',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top'
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            }
                        }
                    }
                });
            } else {
                console.warn('No feedback trend data available');
            }
        })
        .catch(err => {
            console.error('Error setting up feedback trend chart:', err);
        });
}

function setupChatbotLatencyChart() {
    const ctx = safeDestroyChart(chatbotLatencyChart, 'chatbotLatencyChart');
    if (!ctx) return;
    
    fetch('../api/chat-analytics.php?action=get-latency', {
        credentials: 'include',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
        .then(response => {
            console.log('Latency chart response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(result => {
            console.log('Latency chart data received:', result);
            let latencyData = [];
            if (result && typeof result === 'object') {
                if (Array.isArray(result.data)) {
                    latencyData = result.data;
                } else if (Array.isArray(result)) {
                    latencyData = result;
                }
            }
            
            console.log('Parsed latency data:', latencyData, 'Length:', latencyData.length);
            
            if (!latencyData || latencyData.length === 0) {
                console.warn('No latency data available');
                ctx.style.display = 'none';
                document.getElementById('latencyChartPlaceholder').style.display = 'flex';
                showToast('No chat history data available for the past 24 hours', 'info', 5000);
                return;
            }
            
            ctx.style.display = 'block';
            document.getElementById('latencyChartPlaceholder').style.display = 'none';
            
            const labels = latencyData.map(item => item.hour);
            const avgLatencies = latencyData.map(item => parseFloat(item.avg_latency) || 0);
            const maxLatencies = latencyData.map(item => parseFloat(item.max_latency) || 0);
            const minLatencies = latencyData.map(item => parseFloat(item.min_latency) || 0);
            
            chatbotLatencyChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Average Latency (ms)',
                            data: avgLatencies,
                            borderColor: '#0021474d',
                            backgroundColor: 'rgba(0, 33, 71, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointBackgroundColor: '#002147',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2
                        },
                        {
                            label: 'Max Latency (ms)',
                            data: maxLatencies,
                            borderColor: '#f59e0b',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0.4,
                            pointRadius: 2,
                            pointBackgroundColor: '#f59e0b'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: { size: 12, weight: '500' },
                                color: '#374151',
                                padding: 15,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: { size: 12, weight: 'bold' },
                            bodyFont: { size: 11 },
                            padding: 10,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += Math.round(context.parsed.y * 100) / 100 + 'ms';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Latency (ms)',
                                font: { size: 12, weight: 'bold' }
                            },
                            ticks: {
                                font: { size: 10 },
                                color: '#6b7280'
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)',
                                drawBorder: false
                            }
                        },
                        x: {
                            ticks: {
                                font: { size: 10 },
                                color: '#6b7280'
                            },
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        })
        .catch(err => {
            console.error('Error setting up chatbot latency chart:', err);
            ctx.style.display = 'none';
        });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function submitFeedbackResolution(feedbackId) {
    const message = document.getElementById('resolveMessage').value.trim();
    
    if (!message) {
        showToast('Please enter a resolution message', 'warning');
        return;
    }
    
    const feedback = allFeedbackData.find(f => f.id === feedbackId);
    if (!feedback) return;
    
    fetch('../api/feedback.php?action=resolve', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            feedback_id: feedbackId,
            admin_response: message
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Feedback resolved successfully!', 'success');
            closeFeedbackModal();
            loadFeedbackData();
            loadFeedbackStats();
        } else {
            showToast('Error: ' + (data.error || 'Failed to resolve feedback'), 'error');
        }
    })
    .catch(err => {
        console.error('Error:', err);
        showToast('Error resolving feedback', 'error');
    });
}

function initAdminProfileSidebar() {
    const closeSidebarBtn = document.getElementById('adminCloseSidebarBtn');
    const sidebarOverlay = document.getElementById('adminSidebarOverlay');
    const editPicBtn = document.getElementById('adminEditPicBtn');
    const profilePicInput = document.getElementById('adminProfilePicInput');
    const sectionToggles = document.querySelectorAll('.admin-section-toggle');
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeAdminProfileSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeAdminProfileSidebar);
    }
    
    if (editPicBtn && profilePicInput) {
        editPicBtn.addEventListener('click', () => {
            profilePicInput.click();
        });
        
        profilePicInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                updateAdminProfilePicture(file);
            }
        });
    }
    
    sectionToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            const section = toggle.getAttribute('data-section');
            const content = document.getElementById('admin' + section.charAt(0).toUpperCase() + section.slice(1) + 'Content');
            
            if (content) {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? 'block' : 'none';
                toggle.setAttribute('aria-expanded', isHidden);
            }
        });
    });
    
    setupSettingsButtons();
    loadAdminProfileSidebarInfo();
}

function loadAdminProfileSidebarInfo() {
    fetch('../api/session.php?action=get-admin', {
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            if (data && data.success && data.admin) {
                const admin = data.admin;
                const displayName = admin.full_name || admin.email || 'Admin';
                document.getElementById('adminSidebarDisplayName').textContent = displayName;
                
                const emailDisplay = document.getElementById('adminSidebarEmail');
                if (emailDisplay) {
                    emailDisplay.textContent = admin.email || 'N/A';
                }
                
                document.getElementById('adminEmailValue').textContent = admin.email || 'N/A';
                document.getElementById('adminRoleValue').textContent = admin.role || 'Administrator';
                
                let profilePicUrl = admin.profile_picture_url || admin.profile_picture || 
                    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23d0d0d0"/%3E%3Ccircle cx="50" cy="35" r="15" fill="%23a0a0a0"/%3E%3Cellipse cx="50" cy="70" rx="20" ry="18" fill="%23a0a0a0"/%3E%3C/svg%3E';
                
                const sidebarPic = document.getElementById('sidebarAdminPic');
                if (sidebarPic) {
                    sidebarPic.src = profilePicUrl;
                }
                
                const profileSidebarPic = document.getElementById('adminSidebarProfilePic');
                if (profileSidebarPic) {
                    profileSidebarPic.src = profilePicUrl;
                }
            }
        })
        .catch(err => {
            console.error('Error loading admin profile info:', err);
        });
}

function toggleAdminProfileSidebar() {
    const sidebar = document.getElementById('adminProfileSidebar');
    const overlay = document.getElementById('adminSidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function showAddReminderModal() {
    const reminderForm = document.getElementById('reminderAddForm');
    const reminderInput = document.getElementById('reminderInput');
    const btnSave = document.getElementById('btnReminderSave');
    const btnCancel = document.getElementById('btnReminderCancel');
    
    if (!reminderForm) return;

    reminderForm.style.display = 'flex';
    reminderInput.focus();
    reminderInput.value = '';
    
    const handleSave = () => {
        const title = reminderInput.value.trim();
        if (!title) {
            reminderInput.focus();
            return;
        }
        
        addReminderItem(title);
        reminderForm.style.display = 'none';
        reminderInput.value = '';
    };

    const handleCancel = () => {
        reminderForm.style.display = 'none';
        reminderInput.value = '';
    };

    btnSave.replaceWith(btnSave.cloneNode(true));
    btnCancel.replaceWith(btnCancel.cloneNode(true));
    
    const newBtnSave = document.getElementById('btnReminderSave');
    const newBtnCancel = document.getElementById('btnReminderCancel');
    
    newBtnSave.addEventListener('click', handleSave);
    newBtnCancel.addEventListener('click', handleCancel);

    reminderInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSave();
        }
    });
}

function addReminderItem(title) {
    const remindersList = document.getElementById('remindersList');
    if (!remindersList) return;
    
    const noRemindersMsg = remindersList.querySelector('.no-reminders-text');
    if (noRemindersMsg) {
        noRemindersMsg.remove();
    }
    
    const reminderId = 'custom-' + Date.now();
    
    const reminders = JSON.parse(localStorage.getItem('adminReminders') || '[]');
    reminders.unshift({
        id: reminderId,
        title: title,
        createdAt: new Date().toISOString(),
        type: 'custom'
    });
    localStorage.setItem('adminReminders', JSON.stringify(reminders));
    
    const reminderItem = document.createElement('div');
    reminderItem.className = 'reminder-item';
    reminderItem.setAttribute('data-reminder-id', reminderId);
    
    const now = new Date();
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const formattedDate = now.toLocaleDateString('en-US', options);
    
    reminderItem.innerHTML = `
        <div class="reminder-content">
            <button class="reminder-checkbox" title="Mark as complete" aria-label="Mark reminder as complete">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                </svg>
            </button>
            <div class="reminder-details">
                <div class="reminder-header">
                    <div class="reminder-time">${formattedDate}</div>
                </div>
                <div class="reminder-title">${title}</div>
            </div>
        </div>
    `;
    
    const checkboxBtn = reminderItem.querySelector('.reminder-checkbox');
    checkboxBtn.addEventListener('click', function() {
        reminderItem.style.opacity = '0.5';
        reminderItem.style.textDecoration = 'line-through';
        checkboxBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="16 12 12 8 8 12" style="stroke-linecap:round;stroke-linejoin:round;"></polyline>
                <line x1="12" y1="16" x2="12" y2="8" style="stroke-linecap:round;"></line>
            </svg>
        `;
        setTimeout(() => {
            const reminders = JSON.parse(localStorage.getItem('adminReminders') || '[]');
            const updatedReminders = reminders.filter(r => r.id !== reminderId);
            localStorage.setItem('adminReminders', JSON.stringify(updatedReminders));
            
            reminderItem.remove();
            if (remindersList.children.length === 0) {
                remindersList.innerHTML = '<p class="no-reminders-text">No reminders. You\'re all caught up!</p>';
            }
        }, 300);
    });
    
    remindersList.insertBefore(reminderItem, remindersList.firstChild);
}

function setupSettingsButtons() {
    const exportStatsBtn = document.getElementById('adminExportStatsBtn');
    const systemInfoBtn = document.getElementById('adminSystemInfoBtn');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    
    if (exportStatsBtn) {
        exportStatsBtn.addEventListener('click', exportStatistics);
    }
    
    if (systemInfoBtn) {
        systemInfoBtn.addEventListener('click', showSystemInformation);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            performLogout();
        });
    }
}
function closeAdminProfileSidebar() {
    const sidebar = document.getElementById('adminProfileSidebar');
    const overlay = document.getElementById('adminSidebarOverlay');
    
    if (sidebar && overlay) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    }
}

async function updateAdminProfilePicture(file) {
    if (!file) return;
    
    try {
        const formData = new FormData();
        formData.append('profile_picture', file);
        
        const response = await fetch('../admin/upload-admin-profile-picture.php', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            const timestamp = '?t=' + new Date().getTime();

            const profilePic = document.getElementById('sidebarAdminPic');
            if (profilePic) {
                profilePic.src = result.picture_url + timestamp;
            }
            
            const sidebarProfilePic = document.getElementById('adminSidebarProfilePic');
            if (sidebarProfilePic) {
                sidebarProfilePic.src = result.picture_url + timestamp;
            }

            loadAdminProfile();
            loadAdminProfileSidebarInfo();
            
            showToast('Profile picture updated successfully.', 'success');
        } else {
            const errorMsg = result.error || 'Failed to update profile picture';
            console.error('Upload error:', errorMsg);
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Error updating profile picture:', error);
        showToast('Error updating profile picture: ' + error.message, 'error');
    }
}

function performLogout() {
    const buttons = document.querySelectorAll('[id*="Logout"]');
    buttons.forEach(btn => btn.disabled = true);
    
    fetch('../api/session.php?action=logout', {
        method: 'GET',
        credentials: 'include'
    })
        .then(res => res.json())
        .then(data => {
            setTimeout(() => {
                localStorage.clear();
                sessionStorage.clear();

                window.location.href = '../admin/admin_login.html';
            }, 500);
        })
        .catch(err => {
            console.error('Logout error:', err);
            setTimeout(() => {
                window.location.href = '../admin/admin_login.html';
            }, 500);
        });
}
