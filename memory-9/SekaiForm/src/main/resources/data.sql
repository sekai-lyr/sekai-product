INSERT INTO sekai_form_user(user_name, password)
SELECT 'sekai', 'NbCIA6n9SCV5t6P8t42QBOCoLaCCaAFcLSgNIJvnR6s='
WHERE NOT EXISTS (SELECT 1 FROM sekai_form_user WHERE user_name = 'sekai');
