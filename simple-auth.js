// نظام المصادقة البسيط
const SIMPLE_AUTH = {
  users: {
    'admin': { password: 'Admin@2024', role: 'admin', name: 'مدير النظام' },
    'researcher': { password: 'Research@2024', role: 'researcher', name: 'باحث' },
    'ahmed': { password: 'Ahmed@2024', role: 'admin', name: 'أحمد' }
  },
  
  // تسجيل الدخول
  login: function(username, password) {
    const user = this.users[username];
    
    if (user && user.password === password) {
      const userData = {
        username: username,
        role: user.role,
        name: user.name,
        loggedInAt: new Date().toISOString(),
        token: 'auth_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      };
      
      localStorage.setItem('ahmed_auth', JSON.stringify(userData));
      return { success: true, user: userData };
    }
    
    return { success: false, message: 'بيانات الدخول غير صحيحة' };
  },
  
  // التحقق من الجلسة
  checkSession: function() {
    const authData = localStorage.getItem('ahmed_auth');
    if (!authData) return null;
    
    try {
      const user = JSON.parse(authData);
      const loginTime = new Date(user.loggedInAt);
      const now = new Date();
      const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        return user;
      } else {
        this.logout();
        return null;
      }
    } catch (e) {
      this.logout();
      return null;
    }
  },
  
  // تسجيل الخروج
  logout: function() {
    localStorage.removeItem('ahmed_auth');
    window.location.reload();
  },
  
  // إضافة رسالة في السجلات
  addLoginLog: function(username, action) {
    const logElement = document.getElementById('systemLog');
    if (logElement) {
      const time = new Date().toLocaleTimeString('ar-EG');
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry type-${action === 'login' ? 'success' : 'warning'}`;
      logEntry.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-type">${action === 'login' ? 'نجاح' : 'تحذير'}</span>
        ${action === 'login' ? '✅' : '👋'} 
        ${action === 'login' ? `تم تسجيل الدخول: ${username}` : `تم تسجيل الخروج: ${username}`}
      `;
      logElement.prepend(logEntry);
    }
  }
};

// تهيئة النظام عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
  // التحقق من وجود جلسة سابقة
  const currentUser = SIMPLE_AUTH.checkSession();
  
  if (currentUser) {
    // المستخدم مسجل الدخول
    setupLoggedInUI(currentUser);
  } else {
    // إظهار شاشة الدخول
    showLoginScreen();
  }
});

// إعداد واجهة المستخدم بعد الدخول
function setupLoggedInUI(user) {
  // إخفاء شاشة الدخول إذا كانت ظاهرة
  const loginScreen = document.getElementById('simpleLoginScreen');
  if (loginScreen) {
    loginScreen.style.display = 'none';
  }
  
  // إظهار المحتوى الرئيسي
  const mainContainer = document.querySelector('.container');
  if (mainContainer) {
    mainContainer.style.display = 'block';
  }
  
  // إضافة معلومات المستخدم في الهيدر
  const header = document.querySelector('.header');
  if (header) {
    // إزالة أي معلومات مستخدم سابقة
    const oldUserInfo = document.getElementById('userInfoBar');
    if (oldUserInfo) oldUserInfo.remove();
    
    const userInfo = document.createElement('div');
    userInfo.id = 'userInfoBar';
    userInfo.innerHTML = `
      <div style="position: absolute; left: 30px; top: 30px; display: flex; align-items: center; gap: 10px;">
        <span style="background: rgba(46, 213, 115, 0.2); color: #2ed573; padding: 8px 15px; border-radius: 50px; font-size: 14px; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-user-circle"></i>
          <span>${user.name} (${user.role})</span>
        </span>
        <button onclick="logoutUser()" 
                style="background: rgba(255, 71, 87, 0.2); color: #ff4757; border: 1px solid rgba(255, 71, 87, 0.3); 
                       padding: 8px 15px; border-radius: 50px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 8px;">
          <i class="fas fa-sign-out-alt"></i>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    `;
    header.style.position = 'relative';
    header.appendChild(userInfo);
  }
  
  // إضافة رسالة ترحيب في السجلات
  SIMPLE_AUTH.addLoginLog(user.username, 'login');
  
  // تهيئة النظام البحثي
  initializeResearchSystem();
}

// إظهار شاشة الدخول
function showLoginScreen() {
  // إخفاء المحتوى الرئيسي
  const mainContainer = document.querySelector('.container');
  if (mainContainer) {
    mainContainer.style.display = 'none';
  }
  
  // إظهار شاشة الدخول إذا كانت موجودة
  const loginScreen = document.getElementById('simpleLoginScreen');
  if (loginScreen) {
    loginScreen.style.display = 'flex';
  }
}

// دالة الدخول (تسمى من HTML)
function loginUser() {
  const username = document.getElementById('simpleUsername').value.trim();
  const password = document.getElementById('simplePassword').value;
  
  const result = SIMPLE_AUTH.login(username, password);
  
  if (result.success) {
    setupLoggedInUI(result.user);
  } else {
    alert('❌ ' + result.message);
    // اهتزاز الحقول عند الخطأ
    const usernameField = document.getElementById('simpleUsername');
    const passwordField = document.getElementById('simplePassword');
    
    [usernameField, passwordField].forEach(field => {
      field.style.borderColor = '#ff4757';
      field.style.animation = 'shake 0.5s';
      setTimeout(() => {
        field.style.borderColor = '#2ed573';
        field.style.animation = '';
      }, 500);
    });
  }
}

// دالة الخروج
function logoutUser() {
  if (confirm('هل تريد تسجيل الخروج؟')) {
    const currentUser = SIMPLE_AUTH.checkSession();
    if (currentUser) {
      SIMPLE_AUTH.addLoginLog(currentUser.username, 'logout');
    }
    SIMPLE_AUTH.logout();
  }
}

// تهيئة النظام البحثي
function initializeResearchSystem() {
  console.log('🚀 تهيئة النظام البحثي...');
  
  // هنا يمكنك وضع كود تهيئة النظام
  setTimeout(() => {
    const systemLog = document.getElementById('systemLog');
    if (systemLog) {
      const time = new Date().toLocaleTimeString('ar-EG');
      const initMsg = document.createElement('div');
      initMsg.className = 'log-entry type-info';
      initMsg.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-type">معلومات</span>
        🔧 النظام البحثي جاهز للعمل
      `;
      systemLog.prepend(initMsg);
    }
  }, 1000);
}

// إضافة تأثير اهتزاز
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);