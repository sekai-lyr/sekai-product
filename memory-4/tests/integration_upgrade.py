"""Run against an isolated sekai_upgrade_test_* database and its application.
DB_TEST_NAME and MYSQL_PWD must be supplied by the caller. Does not touch production.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('TEST_BASE_URL', 'http://127.0.0.1:18084')
DB = os.environ['DB_TEST_NAME']
assert re.fullmatch(r'sekai_upgrade_test_[a-zA-Z0-9_]+', DB), 'Tests require an isolated database'
checks = []
def check(condition, label):
    assert condition, label
    checks.append(label)
    print('PASS', label, flush=True)
def sql(query):
    result = subprocess.run(['mysql', '-u', os.environ.get('DB_USERNAME', 'root'), '--default-character-set=utf8mb4', '-N', DB], input=query.encode('utf-8'), capture_output=True, check=True)
    return result.stdout.decode('utf-8').strip()
sql((ROOT/'build-data/characters.sql').read_text(encoding='utf-8'))

class Client:
    def __init__(self):
        self.session = requests.Session()
        self.csrf = ''
    def get(self, path):
        response = self.session.get(BASE + path, timeout=25)
        soup = BeautifulSoup(response.text, 'html.parser')
        token = soup.select_one('meta[name="csrf-token"]')
        if token: self.csrf = token.get('content', '')
        return response
    def post(self, path, data=None, api=False, csrf=True):
        values = dict(data or {})
        if csrf: values['_csrf'] = self.csrf
        return self.session.post(BASE + path, data=values, headers={'Accept': 'application/json' if api else 'text/html'}, timeout=30)
    def api(self, path, data=None):
        response = self.post(path, data, True)
        check(response.status_code == 200, 'API ' + path + ' responds')
        return response.json()
    def register(self, name, password):
        self.get('/register')
        response = self.post('/user/register', {'userName': name, 'password': password, 'confirmPassword': password, 'nickName': name, 'admin': 'true'})
        (ROOT/'target/registration-response.html').write_text(response.text, encoding='utf-8')
        node = BeautifulSoup(response.text, 'html.parser').select_one('.recovery-code')
        check(response.status_code == 200 and node is not None, 'Registration issues one-time recovery code')
        return node.get_text(strip=True)
    def login(self, name, password):
        self.get('/login')
        response = self.post('/user/login', {'userName': name, 'password': password})
        (ROOT/'target/login-response.html').write_text(response.text, encoding='utf-8')
        check(response.status_code == 200 and '/home' in response.url, 'Login renders home')
        self.get('/home')

suffix = str(int(time.time()))
name = 'upgrade_' + suffix
password = secrets.token_urlsafe(18)
a = Client(); login = a.get('/login')
check(login.status_code == 200 and 'csrf-token' in login.text, 'Login renders CSRF metadata')
check(a.post('/user/register', {}, csrf=False).status_code == 403, 'Mutation without CSRF rejected')
code = a.register(name, password)
a.login(name, password)
uid = int(sql("SELECT id FROM sekai_Draw_lots_user WHERE username='" + name + "'"))
check(sql(f'SELECT is_admin FROM sekai_Draw_lots_user WHERE id={uid}') == '0', 'Registration cannot assign administrator role')
check(a.get('/admin').status_code == 403, 'Ordinary user cannot enter admin')
check(a.api('/user/reset-password', {'userName':name,'newPassword':'other-password','token':'invalid'})['success'] is False, 'Username alone cannot reset password')
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    def daily(_):
        response = requests.post(BASE + '/draw/daily', cookies=a.session.cookies.get_dict(), data={'_csrf':a.csrf,'mood':'平静'}, timeout=30)
        assert response.status_code == 200, response.text[:200]
        data=response.json(); assert data['success'], data.get('message'); return data['data']
    daily_results=list(pool.map(daily, range(8)))
record=daily_results[0]; record_id=record['id']
check(len({r['id'] for r in daily_results}) == 1, 'Eight concurrent daily requests return one record')
check(sql(f"SELECT COUNT(*) FROM sekai_Draw_lots_record WHERE user_id={uid} AND draw_type='DAILY'") == '1', 'Daily uniqueness enforced in database')
roll=a.api('/draw/roll', {'wishTopic':'每日固定签','mood':'平静'})
check(roll['success'] and roll['data']['drawType']=='RANDOM', 'User wish text cannot impersonate daily draw')
check(a.api('/draw/daily', {'mood':'燃'})['data']['id']==record_id, 'Daily result remains stable after random draw')
ritual=a.api('/draw/ritual', {'wishTopic':'完成测试作品','mood':'需要灵感'})
check(ritual['success'] and len(ritual['data']['cards']) == 3, 'Custom wish ritual returns three cards')
wish_id=ritual['data']['cards'][0]['record']['wishId']
check(wish_id is not None and len({c['record']['ritualId'] for c in ritual['data']['cards']}) == 1, 'Ritual shares explicit ID and wish association')
dashboard=a.get('/api/dashboard').json()
check(next(x for x in dashboard['achievements'] if x['code']=='ritual-reader')['unlocked'], 'Custom ritual unlocks persistent achievement')
response=a.post(f'/wishes/{wish_id}', {'completed':'true','review':'作品已经完成，下一步继续完善。'})
check(response.status_code==200 and '作品已经完成' in response.text, 'Wish completion and review save')
check('completed' not in sql(f'SELECT review FROM sekai_Draw_lots_wish WHERE id={wish_id}') and sql(f'SELECT completed FROM sekai_Draw_lots_wish WHERE id={wish_id}')=='1', 'Wish completion persisted')
for route in ['/characters','/characters?page=2','/history','/history?start=2020-01-01&end=2030-01-01','/history?wishId='+str(wish_id),'/favorites','/account','/wishes']:
    response=a.get(route)
    check(response.status_code==200, 'Page ' + route + ' renders')
check('暂时没有匹配' in a.get('/characters?keyword=definitely-no-such-companion').text, 'Character empty state renders')
check(a.get('/history?start=2026-10-28&end=2026-10-01').status_code==400, 'Invalid date range rejected')

wheel=a.get('/wheel'); check(wheel.status_code==200,'Wheel page renders')
soup=BeautifulSoup(wheel.text,'html.parser'); deck_id=int(soup.select_one('select[name="deckId"] option[selected]')['value'])
response=a.post('/wheel/decks',{'name':'测试学习转盘'}); check(response.status_code==200,'Create second wheel deck')
deck2=int(re.search(r'deckId=(\d+)',response.url).group(1))
check(a.api('/wheel/spin', {'deckId':deck2})['success'] is False,'Empty wheel does not silently reseed')
response=a.post('/wheel/options',{'deckId':deck2,'title':'只做这一件事','detail':'隔离测试','weight':4,'color':'#ffe08a'})
check(response.status_code==200,'Add wheel option')
option_id=int(sql(f'SELECT id FROM sekai_Draw_lots_wheel_option WHERE deck_id={deck2} LIMIT 1'))
check(a.api('/wheel/spin',{'deckId':deck2})['data']['option']['id']==option_id,'Spin uses selected deck only')
response=a.post(f'/wheel/options/{option_id}',{'deckId':deck2,'title':'修改后的任务','detail':'已编辑','weight':2,'color':'#78d5ff','sortOrder':7})
check(response.status_code==200 and sql(f'SELECT enabled FROM sekai_Draw_lots_wheel_option WHERE id={option_id}')=='0','Edit, reorder and disable wheel option')
check(a.api('/wheel/spin',{'deckId':deck2})['success'] is False,'Disabled options excluded from spin')
a.post(f'/wheel/options/{option_id}',{'deckId':deck2,'title':'修改后的任务','detail':'已编辑','weight':2,'color':'#78d5ff','sortOrder':7,'enabled':'true'})
check(a.api('/wheel/spin',{'deckId':deck2})['data']['option']['title']=='修改后的任务','Re-enabled edited option is used')

share=a.get(f'/share/records/{record_id}'); check(share.status_code==200,'Share settings page renders')
svg=a.get(f'/share/records/{record_id}.svg?hideName=true&theme=paper')
check(svg.status_code==200 and name not in svg.text and '#eee7dc' in svg.text,'Share template and hidden nickname applied')
png=a.get(f'/share/records/{record_id}.png?hideName=true&download=true')
check(png.status_code==200 and png.content.startswith(b'\x89PNG\r\n\x1a\n') and 'attachment' in png.headers.get('Content-Disposition',''),'PNG download is a real PNG attachment')

# Move earlier achievements beyond the old rolling window without altering other users.
sql(f"UPDATE sekai_Draw_lots_record SET fortune_score=99 WHERE id={record_id}")
a.get('/api/dashboard')
for _ in range(3):
    sql(f"INSERT INTO sekai_Draw_lots_record (user_id,character_id,fortune_id,mood,wish_topic,fortune_score,message) SELECT user_id,character_id,fortune_id,mood,'回归记录',60,'测试记录' FROM sekai_Draw_lots_record WHERE user_id={uid}")
sql(f"INSERT INTO sekai_Draw_lots_record (user_id,character_id,fortune_id,mood,wish_topic,fortune_score,message) SELECT user_id,character_id,fortune_id,mood,'回归记录',60,'测试记录' FROM sekai_Draw_lots_record WHERE user_id={uid}")
dashboard=a.get('/api/dashboard').json()
check(next(x for x in dashboard['achievements'] if x['code']=='high-score')['unlocked'],'Achievement survives more than 80 newer records')
check(a.get('/history?page=2').status_code==200 and int(sql(f'SELECT COUNT(*) FROM sekai_Draw_lots_record WHERE user_id={uid}'))>80,'History paginates beyond original record window')

b=Client(); name2='other_'+suffix; password2=secrets.token_urlsafe(18); code2=b.register(name2,password2); b.login(name2,password2)
check(b.get(f'/share/records/{record_id}.svg').status_code==404,'Another user cannot export private share card')
check(b.get(f'/history?wishId={wish_id}').status_code==404,'Another user cannot view private wish')
check(b.post('/wheel/spin',{'deckId':deck2},api=True).status_code==404,'Another user cannot spin private deck')
check(b.post(f'/wheel/options/{option_id}/delete',{'deckId':deck2}).status_code==404,'Another user cannot delete private option')
recovery=Client(); recovery.get('/recover')
token=recovery.api('/user/recovery-token',{'userName':name2,'recoveryCode':code2})['data']
check(not recovery.api('/user/recovery-token',{'userName':name2,'recoveryCode':code2})['success'],'Recovery code cannot be reused')
new_password=secrets.token_urlsafe(18)
check(recovery.api('/user/reset-password',{'token':token,'newPassword':new_password})['success'],'Verified token resets password')
check(not recovery.api('/user/reset-password',{'token':token,'newPassword':new_password})['success'],'Reset token cannot be reused')
check(b.get('/api/dashboard').status_code==401,'Password reset revokes previous sessions')
b.login(name2,new_password)
rotation=b.post('/user/recovery-code',{'currentPassword':new_password})
code3=BeautifulSoup(rotation.text,'html.parser').select_one('.recovery-code').get_text(strip=True)
token3=recovery.api('/user/recovery-token',{'userName':name2,'recoveryCode':code3})['data']
sql("UPDATE sekai_Draw_lots_user SET reset_expires=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE username='"+name2+"'")
check(not recovery.api('/user/reset-password',{'token':token3,'newPassword':new_password})['success'],'Expired reset token rejected')

sql(f'UPDATE sekai_Draw_lots_user SET is_admin=TRUE WHERE id={uid}')
check(a.get('/admin').status_code==200,'Authorized administrator sees content manager')
character={'englishName':'Review Companion '+suffix,'animeTitle':'测试系列','archetype':'guardian','element':'Moon','quote':'勇气与坚持','imageUrl':'','popularity':50,'enabled':'true','action':'preview'}
before=sql('SELECT COUNT(*) FROM sekai_Draw_lots_character')
response=a.post('/admin/characters',character)
check(response.status_code==200 and '未保存预览' in response.text and before==sql('SELECT COUNT(*) FROM sekai_Draw_lots_character'),'Admin previews without saving')
character['action']='save'; response=a.post('/admin/characters',character)
check(response.status_code==200 and '/admin/characters/' in response.url,'Admin saves new character')
cid=int(response.url.rsplit('/',1)[1]); character['id']=cid; character.pop('enabled')
a.post('/admin/characters',character)
check(sql(f'SELECT enabled FROM sekai_Draw_lots_character WHERE id={cid}')=='0','Admin can disable character')
fortune={'levelName':'回归签'+suffix,'scoreMin':70,'scoreMax':80,'luckyColor':'暖白','luckyItem':'手账','summary':'继续前进','advice':'先完成一个小步骤。','enabled':'true'}
response=a.post('/admin/fortunes',fortune)
check(response.status_code==200 and '/admin/fortunes/' in response.url,'Admin creates fortune')
check(b.post('/admin/fortunes',fortune).status_code==403,'Ordinary user cannot mutate content')
check(a.get('/admin/characters/new').status_code==200 and a.get('/admin/fortunes/new').status_code==200,'New content editor pages render')
(ROOT/'target/test-browser.json').write_text(json.dumps({'name':name,'password':password,'recordId':record_id,'deckId':deck2,'characterId':cid,'wishId':wish_id}),encoding='utf-8')
(ROOT/'target/integration-results.json').write_text(json.dumps({'checks':len(checks),'passed':checks},ensure_ascii=False,indent=2),encoding='utf-8')
print('ALL PASSED:',len(checks),flush=True)
