-- 정규화: 앱의 rolePermissions.json / userRoles.json 과 대응 (STORE_BACKEND=rdb)

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='role_permissions' AND xtype='U')
CREATE TABLE role_permissions (
  n_role_id      INT            NOT NULL,
  str_permission NVARCHAR(120)  NOT NULL,
  CONSTRAINT PK_role_permissions PRIMARY KEY (n_role_id, str_permission),
  CONSTRAINT FK_role_permissions_roles FOREIGN KEY (n_role_id) REFERENCES dbo.roles(n_id) ON DELETE CASCADE
);
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_roles' AND xtype='U')
CREATE TABLE user_roles (
  n_user_id INT NOT NULL,
  n_role_id INT NOT NULL,
  CONSTRAINT PK_user_roles PRIMARY KEY (n_user_id, n_role_id),
  CONSTRAINT FK_user_roles_users FOREIGN KEY (n_user_id) REFERENCES dbo.users(n_id) ON DELETE CASCADE,
  CONSTRAINT FK_user_roles_roles FOREIGN KEY (n_role_id) REFERENCES dbo.roles(n_id) ON DELETE RESTRICT
);
GO
