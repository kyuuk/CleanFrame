from pathlib import Path
import sys, base64, ipaddress, json, os, re, socket, subprocess, time, uuid, urllib.request
r=Path(__file__).resolve().parents[2]; d=r/'.local/native-home'
mode=sys.argv[1] if len(sys.argv)>1 else 'query'
if mode not in ['query','record','apply','restore','inspect','diagnose','eligible']:raise SystemExit('Unknown action')
if mode=='record' and (d/'original.json').exists():raise SystemExit('Baseline already recorded; original.json unchanged and nothing staged.')
def record(output):
 # Keep the first pre-apply query verbatim as the exact-value rollback baseline; never the applied state.
 app=re.search(r'<tizen:application id="([^"]+)"',(r/'app/config.xml').read_text()).group(1)
 keys=['db/appfw/home_appid','db/appfw/startup_appid','db/appfw/booting_appid_backup','db/first_screen/type']
 lines=[line for line in output.splitlines() if line.startswith('CLEANFRAME_HOME_JSON=')]
 if len(lines)!=1:raise RuntimeError('Query returned no single snapshot; nothing recorded.')
 text=lines[0][len('CLEANFRAME_HOME_JSON='):].strip();s=json.loads(text);strings=s.get('Strings') or {}
 if not s.get('Home') or sorted(strings)!=sorted(keys) or not all(strings.values()) or s.get('Autostart') not in [0,1]:raise RuntimeError('Incomplete snapshot; nothing recorded.')
 if any(app in value for value in [s['Home'],*strings.values()]):raise RuntimeError('Launcher already assigned; this is not an original baseline. Nothing recorded.')
 with open(d/'original.json','x') as baseline:baseline.write(text+'\n')
 os.chmod(d/'original.json',0o444)
 print('Baseline recorded: '+str(d/'original.json'))
# An installed SDK, such as C:\tizen-studio, can replace the workspace-local copy (same variable as package.py).
sdb=Path(os.environ.get('CLEANFRAME_TIZEN_SDK') or r/'.local/tizen-sdk')/'tools'/('sdb.exe' if os.name=='nt' else 'sdb')
if not sdb.exists():raise SystemExit('SDB not found at '+str(sdb)+'; set CLEANFRAME_TIZEN_SDK. Nothing staged.')
sdb=str(sdb)
host=json.loads((r/'.local/device.json').read_text())['host'];ipaddress.ip_address(host)
with urllib.request.urlopen('http://'+host+':8001/api/v2/',timeout=4) as response: info=json.load(response)
# Reference Frame, then a contributor's Tizen 8 TV (applied 26 October 2026); Control.cs guards the matching firmware.
if info.get('device',{}).get('modelName') not in ['QA55LS03DAWXXY','ED50T01UHD-RE']:raise SystemExit('Model guard failed; nothing staged.')
serial=host+':26101'
def run(args,timeout=12):
 p=subprocess.run([sdb,*args],capture_output=True,text=True,timeout=timeout)
 if p.returncode:raise RuntimeError('SDB transport failed: '+p.stdout[-300:]+p.stderr[-300:])
 return p
run(['connect',serial])
d.mkdir(parents=True,exist_ok=True)
# Re-stage reviewed helper files on each run so rollback survives SDK temporary-file cleanup; inspect and diagnose are shell-only.
for suffix in [] if mode in ['inspect','diagnose'] else ['dll','runtimeconfig.json','deps.json']:
    source=d/'out'/('CleanFrameHomeControl.'+suffix)
    run(['-s',serial,'push',str(source),'/home/owner/share/tmp/sdk_tools/CleanFrameHomeControl.'+suffix])
if mode in ['apply','restore']:
    run(['-s',serial,'push',str(d/'original.json'),'/home/owner/share/tmp/sdk_tools/CleanFrameHomeOriginal.json'])
token=uuid.uuid4().hex[:12];remote='/home/owner/share/tmp/sdk_tools/cfhi-'+token+'.sh'
# Stage an LF copy: a Windows checkout may convert the shell source to CRLF, which the TV's bash rejects.
staged=d/('staged-'+mode+'.sh')
staged.write_bytes((r/'scripts/native-home'/(('query' if mode=='record' else mode)+'.sh')).read_bytes().replace(b'\r\n',b'\n'))
run(['-s',serial,'push',str(staged),remote])
with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as route:
 route.connect((host,9));local=route.getsockname()[0]
with socket.socket() as listener:
 listener.bind((local,0));listener.listen(1);listener.settimeout(18);port=listener.getsockname()[1]
 command='exec 3<>/dev/tcp/'+local+'/'+str(port)+';cat '+remote+'|bash >&3 2>&3;exec 3>&-'
 script='/bin/mkdir /tmp/s-'+token+' 2>/dev/null&&{ '+command+';}'
 encoded=base64.b64encode(script.encode()).decode()
 name='new2.tpk`printf${IFS}%s${IFS}'+encoded+'|base64${IFS}-d|bash`.tpk'
 argument='0 appinstall tpk '+name
 if len(argument.encode())>400:raise SystemExit('Command exceeds reviewed transport length; not executed.')
 proc=subprocess.Popen([sdb,'-s',serial,'shell',argument],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  connection,peer=listener.accept()
  if peer[0]!=host:raise RuntimeError('Unexpected callback peer; no data accepted.')
  chunks=[]
  with connection:
   connection.settimeout(8)
   while True:
    chunk=connection.recv(65536)
    if not chunk:break
    chunks.append(chunk)
    if sum(map(len,chunks))>100000:raise RuntimeError('Unexpectedly large diagnostic output.')
  output=b''.join(chunks).decode(errors='replace')
  try:stdout,stderr=proc.communicate(timeout=8)
  except subprocess.TimeoutExpired:proc.terminate();stdout,stderr=proc.communicate(timeout=3)
  (d/(mode+'-output.txt')).write_text(output)
  (d/(mode+'-transport.json')).write_text(json.dumps({'returncode':proc.returncode,'stdout':stdout,'stderr':stderr,'remote_probe':remote,'time':time.time()},indent=2))
  if 'CLEANFRAME_HOME_INSPECT_BEGIN' not in output or 'CLEANFRAME_HOME_INSPECT_END' not in output:raise RuntimeError('Probe incomplete; device state is unknown. Inspect current values before retrying.')
  print(output)
  if 'CLEANFRAME_HOME_EXIT=' in output:raise SystemExit('Helper refused or failed; see its message above. Apply failures restore the original values.')
  if mode=='record':record(output)
 finally:
  if proc.poll() is None:proc.terminate();proc.communicate(timeout=3)
