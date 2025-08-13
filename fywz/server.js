const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { log } = require('console');

const pendingPostsPath = path.join(__dirname, 'data', 'blog-data-reviewed.json');

const app = express();
const upload = multer();

app.use(express.static('.'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 读取博客数据
function getBlogPosts() {
    const blogDataPath = path.join(__dirname, 'data/blog-data.json');
    if (fs.existsSync(blogDataPath)) {
        const data = fs.readFileSync(blogDataPath, 'utf8');
        if (data.trim()) {
            return JSON.parse(data);
        }
    }
    return [];
}

// 读取待审核博客数据
function getReviewedBlogPosts() {
    const blogDataPath = path.join(__dirname, 'data/blog-data-reviewed.json');
    if (fs.existsSync(blogDataPath)) {
        try {
            const data = fs.readFileSync(blogDataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('解析待审核博客数据失败:', error);
            return [];
        }
    }
    return [];
}

// 处理待审核帖子提交请求
app.post('/submit-review', upload.none(), async (req, res) => { // 修改为异步函数
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).send('标题和内容不能为空');
    }

    // 生成随机ID
    const generateRandomId = () => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    try {
        // 获取客户端 IP
        const ipResponse = await fetch('https://httpbin.org/ip');
        const ipData = await ipResponse.json();
        const clientIp = ipData.origin;

        // 获取用户信息
        const userInfo = getUserData();
        const matchedUser = userInfo ? userInfo.find(user => user.user_ip.includes(clientIp)) : null;

        // 去除 user_password
        if (matchedUser) {
            delete matchedUser.user_password;
            delete matchedUser.user_ip;
            delete matchedUser.user_info
        }

        const blogPost = {
            id: generateRandomId(),
            title,
            content,
            date: new Date().toISOString(),
            user_info: matchedUser || {} // 附带用户信息
        };

        const blogDataPath = path.join(__dirname, 'data/blog-data-reviewed.json');
        let blogPosts = getReviewedBlogPosts();
        // 确保 blogPosts 是数组
        if (!Array.isArray(blogPosts)) {
            blogPosts = [];
        }
        blogPosts.push(blogPost);
        fs.writeFileSync(blogDataPath, JSON.stringify(blogPosts, null, 2));

        res.redirect("../blog")

    } catch (error) {
        console.error('提交帖子时获取用户信息失败:', error);
        res.status(500).send('服务器内部错误');
    }
});

// 添加访问提交页面的路由
app.get('/submit-post', (req, res) => {
    res.sendFile(path.join(__dirname, 'submit-post.html'));
});

// 渲染主页
app.get(['/', '/index.html'], (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 添加获取博客数据的接口
app.get('/api/blogs', (req, res) => {
    const posts = getBlogPosts();
    res.json(posts);
});

// 添加获取待审核博客数据的接口
app.get('/api/reviewed-blogs', (req, res) => {
    const posts = getReviewedBlogPosts();
    res.json(posts);
});

// 添加审核页面路由
app.get('/blog/moderation', (req, res) => {
    res.sendFile(path.join(__dirname, 'post_moderation.html'));
});

app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/blog', (req, res) => {
    res.sendFile(path.join(__dirname, 'blog.html'));
});

// 添加 news 和 people 路由
app.get('/news', (req, res) => {
    res.sendFile(path.join(__dirname, 'news.html'));
});

app.get('/people', (req, res) => {
    res.sendFile(path.join(__dirname, 'people.html'));
});

// 添加访问 navbar.html 的路由
app.get('/navbar.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'navbar.html'));
});

// 获取待审核帖子接口
app.get('/pending-posts', (req, res) => {
    try {
        if (fs.existsSync(pendingPostsPath)) {
            const data = fs.readFileSync(pendingPostsPath, 'utf8');
            const posts = JSON.parse(data);
            res.json(posts);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('读取待审核帖子失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 处理审核通过请求接口
app.post('/approve-post', express.json(), (req, res) => {
    try {
        const { id } = req.body; // 假设使用 id 作为帖子唯一标识 
        if (!id) {
            return res.status(400).json({ error: '缺少帖子 ID' });
        }

        // 读取待审核帖子数据 
        let pendingPosts = [];
        if (fs.existsSync(pendingPostsPath)) {
            const data = fs.readFileSync(pendingPostsPath, 'utf8');
            pendingPosts = JSON.parse(data);
        }

        // 查找要审核通过的帖子 
        const approvedPost = pendingPosts.find(post => post.id === id);
        if (!approvedPost) {
            return res.status(404).json({ error: '未找到该待审核帖子' });
        }

        // 从待审核列表中移除该帖子 
        const newPendingPosts = pendingPosts.filter(post => post.id !== id);
        fs.writeFileSync(pendingPostsPath, JSON.stringify(newPendingPosts, null, 2));

        // 读取已审核通过的帖子数据文件路径，修改为 blog-data.json
        const approvedPostsPath = path.join(__dirname, 'data', 'blog-data.json');
        let approvedPosts = [];
        if (fs.existsSync(approvedPostsPath)) {
            const data = fs.readFileSync(approvedPostsPath, 'utf8');
            // 检查文件内容是否为空
            if (data.trim()) {
                approvedPosts = JSON.parse(data);
            }
        }

        // 将该帖子添加到已审核通过列表 
        approvedPosts.push(approvedPost);
        fs.writeFileSync(approvedPostsPath, JSON.stringify(approvedPosts, null, 2));

        res.json({ success: true, message: '帖子审核通过' });
    } catch (error) {
        console.error('处理审核通过请求失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 处理拒绝帖子请求接口
app.post('/reject-post', express.json(), (req, res) => {
    try {
        const { id } = req.body; // 假设使用 id 作为帖子唯一标识 
        if (!id) {
            return res.status(400).json({ error: '缺少帖子 ID' });
        }

        // 读取待审核帖子数据 
        let pendingPosts = [];
        if (fs.existsSync(pendingPostsPath)) {
            const data = fs.readFileSync(pendingPostsPath, 'utf8');
            pendingPosts = JSON.parse(data);
        }

        // 查找要拒绝的帖子 
        const rejectedPostIndex = pendingPosts.findIndex(post => post.id === id);
        if (rejectedPostIndex === -1) {
            return res.status(404).json({ error: '未找到该待审核帖子' });
        }

        // 从待审核列表中移除该帖子 
        pendingPosts.splice(rejectedPostIndex, 1);
        fs.writeFileSync(pendingPostsPath, JSON.stringify(pendingPosts, null, 2));

        res.json({ success: true, message: '帖子已拒绝' });
    } catch (error) {
        console.error('处理拒绝帖子请求失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 删除帖子接口
app.delete('/api/delete-post', express.json(), async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: '缺少帖子 ID' });
        }

        // 获取客户端 IP
        const ipResponse = await fetch('https://httpbin.org/ip');
        const ipData = await ipResponse.json();
        const clientIp = ipData.origin;
        const userInfo = getUserData();
        const user = userInfo ? userInfo.find(u => u.user_ip.includes(clientIp)) : null;

        // 读取博客数据
        const blogDataPath = path.join(__dirname, 'data/blog-data.json');
        let blogPosts = getBlogPosts();
        const postIndex = blogPosts.findIndex(post => post.id === id);
        if (postIndex === -1) {
            return res.status(404).json({ error: '未找到该帖子' });
        }

        // 检查用户是否是作者或管理员
        const post = blogPosts[postIndex];
        if (user && (user.user_permission === 'admin' || (post.user_info && post.user_info.user_name === user.user_name))) {
            blogPosts.splice(postIndex, 1);
            fs.writeFileSync(blogDataPath, JSON.stringify(blogPosts, null, 2));
            return res.json({ success: true, message: '帖子删除成功' });
        } else {
            return res.status(403).json({ error: '没有删除权限' });
        }
    } catch (error) {
        console.error('删除帖子失败:', error);
        return res.status(500).json({ error: '服务器内部错误' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});

const staticInfoPath = path.join(__dirname, 'data', 'static_info.json');

// 读取静态信息文件
function getStaticInfo() {
    if (fs.existsSync(staticInfoPath)) {
        const data = fs.readFileSync(staticInfoPath, 'utf8');
        return JSON.parse(data);
    }
    return { visitors: 0, visitor_ip: [] };
}

// 保存静态信息文件
function saveStaticInfo(info) {
    fs.writeFileSync(staticInfoPath, JSON.stringify(info, null, 2));
}

// 访问计数接口
app.get('/api/visit-count', async (req, res) => {
    try {
        // 使用 ipapi.co 接口获取用户 IP 信息
        const staticInfo = getStaticInfo();
        
        // 修改为 HTTPS 请求
        const ipResponse = await fetch('http://httpbin.org/ip');
        const ipData = await ipResponse.json();
        
        const clientIp = ipData.origin;
        
        if (!staticInfo.visitor_ip.includes(clientIp)) {
            staticInfo.visitor_ip.push(clientIp);
            staticInfo.visitor_number += 1;
            saveStaticInfo(staticInfo);
        }
        
        res.json({ visitors: staticInfo.visitor_number });
        
    } catch (error) {
        console.error('获取 IP 失败:', error);
        res.status(500).json({ error: '获取 IP 失败' });
    }
});

// 获取ip接口
app.get('/api/visit-ip', async (req, res) => {
    try {
        // 修改为 HTTPS 请求
        const ipResponse = await fetch('http://httpbin.org/ip');
        const ipData = await ipResponse.json();
        const clientIp = ipData.origin;

        const userInfo = getUserData();
        const matchedUser = userInfo.find(user => user.user_ip.includes(clientIp));

        res.json({ ip: clientIp, user_info: matchedUser });

    } catch (error) {
        console.error('获取 IP 失败:', error);
        res.status(500).json({ error: '获取 IP 失败' });
    }
});

const userInfoPath = path.join(__dirname, 'data', 'user_data.json');

// 读取静态信息文件
function getUserData() {
    if (fs.existsSync(userInfoPath)) {
        const data = fs.readFileSync(userInfoPath, 'utf8');
        return JSON.parse(data);
    }
    return null;
}

// 保存用户信息文件
function saveUserInfo(info) {
    fs.writeFileSync(userInfoPath, JSON.stringify(info, null, 2));
}

// 添加登录和注册路由
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'register.html'));
});

// 登录接口
app.post('/api/login', express.json(), async (req, res) => {
    try {
        const { username, password } = req.body;
        const userInfo = getUserData() || [];

        if (userInfo.length === 0) {
            return res.json({ success: false, message: '用户数据为空，请先注册' });
        }

        const matchedUser = userInfo.find(user => user.user_name === username && user.user_password === password);

        if (matchedUser) {
            // 获取客户端 IP
            const ipResponse = await fetch('http://httpbin.org/ip');
            const ipData = await ipResponse.json();
            const clientIp = ipData.origin;

            // 如果 IP 不在列表中，则添加到 user_ip 列表
            if (!matchedUser.user_ip.includes(clientIp)) {
                matchedUser.user_ip.push(clientIp);
                saveUserInfo(userInfo);
            }

            return res.json({ success: true, message: '登录成功' });
        } else {
            return res.json({ success: false, message: '用户名或密码错误' });
        }
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 注册接口
app.post('/api/register', express.json(), (req, res) => {
    try {
        const { username, password, ip } = req.body;
        const userInfo = getUserData() || [];

        if (userInfo.some(user => user.user_name === username)) {
            return res.json({ success: false, message: '用户名已存在' });
        }

        // 生成随机 ID
        const generateRandomId = () => {
            return Math.random().toString(36).substr(2, 9);
        };
        const id = generateRandomId();

        // 创建新用户对象，以列表存储 IP，添加 user_info 字典和默认权限
        const newUser = {
            id,
            user_name: username,
            user_password: password,
            user_ip: [ip], // 以列表存储 IP
            user_permission: 'user', // 默认权限为 user
            created_at: new Date().toISOString(),
            user_info: {
                "coin_number": 0,
                "blog_id": []
            } // 添加空的 user_info 字典
        };

        // 添加新用户到用户数据
        userInfo.push(newUser);

        // 保存用户数据
        saveUserInfo(userInfo);

        // 返回成功响应
        res.json({ success: true, message: '注册成功', user: { id, user_name: username } });
    } catch (error) {
        console.error('注册出错:', error);
        res.status(500).json({ success: false, message: '注册失败，请稍后重试' });
    }
});