CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'cliente') NOT NULL DEFAULT 'cliente',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform ENUM('facebook', 'instagram', 'x', 'tiktok') NOT NULL,
  external_id VARCHAR(255) NOT NULL,
  handle VARCHAR(255),
  display_name VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  connection_status ENUM('pendiente', 'conectada', 'token_vencido', 'error', 'desconectada') NOT NULL DEFAULT 'pendiente',
  connection_method ENUM('oauth', 'manual') NOT NULL DEFAULT 'oauth',
  connected_by INT,
  connected_at DATETIME,
  last_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (connected_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY uq_platform_account (platform, external_id)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  state VARCHAR(255) NOT NULL UNIQUE,
  platform ENUM('facebook', 'instagram', 'x', 'tiktok') NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account_snapshots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  social_account_id INT NOT NULL,
  snapshot_date DATE NOT NULL,
  followers INT DEFAULT 0,
  following INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  reach INT DEFAULT 0,
  impressions INT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.00,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_snapshot (social_account_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  social_account_id INT NOT NULL,
  external_post_id VARCHAR(255) NOT NULL,
  type ENUM('foto', 'video', 'reel', 'texto') DEFAULT 'foto',
  content_preview TEXT,
  url VARCHAR(1024),
  published_at DATETIME,
  likes INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares INT DEFAULT 0,
  views INT DEFAULT 0,
  last_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_post (social_account_id, external_post_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  external_comment_id VARCHAR(255) NOT NULL,
  author_handle VARCHAR(255),
  content TEXT,
  sentiment VARCHAR(50) DEFAULT NULL,
  published_at DATETIME,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_comment (post_id, external_comment_id)
)
