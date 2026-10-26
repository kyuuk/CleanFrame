"""Build and sign with the official Tizen SDK (macOS, or Windows with Tizen Studio)."""
from pathlib import Path
import os
import subprocess
import tempfile
import time
import xml.etree.ElementTree as XML
import zipfile
from font_assets import write_widget_archive

ROOT = Path(__file__).resolve().parents[1]
WINDOWS = os.name == 'nt'
LOCAL_SDK = ROOT / '.local/tizen-sdk'
# An installed SDK, such as C:\tizen-studio, can replace the workspace-local copy.
SDK = Path(os.environ.get('CLEANFRAME_TIZEN_SDK') or LOCAL_SDK)
PRIVATE = ROOT / '.local/certificates/private'
CLI = SDK / 'tools/ide/bin' / ('tizen.bat' if WINDOWS else 'tizen')
password_file = PRIVATE / 'certificate-password.txt'
if not CLI.exists() or not password_file.exists():
    raise SystemExit('Local SDK or signing credentials missing. See docs/development.md.')
password = password_file.read_bytes().strip()
if not password:
    raise SystemExit('Signing password is empty.')
dist = ROOT / 'dist'
dist.mkdir(exist_ok=True)
if SDK == LOCAL_SDK:
    # Only the workspace copy is repointed; an installed SDK keeps its own sdk.info.
    data = SDK / 'data'
    data.mkdir(exist_ok=True)
    (SDK / 'sdk.info').write_text('TIZEN_SDK_INSTALLED_PATH=' + str(SDK) + '\nTIZEN_SDK_DATA_PATH=' + str(data) + '\nJDK_PATH=' + str(SDK / 'jdk') + '\n')
profile = PRIVATE / 'profiles.xml'
tree = XML.parse(profile)
for item in tree.getroot().iter('profileitem'):
    for key in ['key', 'ca', 'rootca']:
        value = item.get(key)
        if value:
            folder = PRIVATE if key == 'key' else PRIVATE.parent / 'ca'
            item.set(key, str(folder / Path(value).name))
tree.write(profile, encoding='UTF-8', xml_declaration=True)
profile.chmod(0o600)


def configured_profiles():
    result = subprocess.run([str(CLI), 'cli-config', '-l'], capture_output=True, text=True, timeout=30)
    for line in result.stdout.splitlines():
        if line.startswith('default.profiles.path='):
            return line.split('=', 1)[1].strip() or None
    return None


def use_profiles(path):
    setting = 'default.profiles.path=' + str(path)
    # cmd.exe splits unquoted batch arguments at '=', so Windows needs the pair quoted.
    command = '"' + str(CLI) + '" cli-config "' + setting + '"' if WINDOWS else [str(CLI), 'cli-config', setting]
    result = subprocess.run(command, capture_output=True, timeout=30)
    if result.returncode:
        raise SystemExit('SDK signing profile configuration failed.')


def answer_prompts(command):
    """Supply the password to the SDK's terminal prompts and decline saving it."""
    import pty
    import select
    import signal
    pid, terminal = pty.fork()
    if pid == 0:
        os.execv(command[0], command)
    output = b''
    passwords = saves = 0
    deadline = time.monotonic() + 60
    try:
        while time.monotonic() < deadline:
            ready, _, _ = select.select([terminal], [], [], 1)
            if ready:
                try:
                    chunk = os.read(terminal, 8192)
                except OSError:
                    break
                if not chunk:
                    break
                output += chunk
                count = output.lower().count(b'password:')
                if count > passwords:
                    os.write(terminal, password + b'\n')
                    passwords = count
                count = output.count(b'No: (N) ?')
                if count > saves:
                    os.write(terminal, b'n\n')
                    saves = count
        else:
            os.kill(pid, signal.SIGTERM)
            raise SystemExit('SDK signing timed out.')
    finally:
        os.close(terminal)
    os.waitpid(pid, 0)
    return output


def saved_password_profile(folder):
    """Windows: the SDK's Java console is unavailable under a pipe, so it cannot prompt.
    Give a temporary profile copy the SDK's own DPAPI password file instead."""
    saved = folder / 'signing.pwd'
    encryptor = SDK / 'tools/certificate-encryptor/wincrypt.exe'
    # wincrypt exits non-zero even after success; the round trip is the real check.
    subprocess.run([str(encryptor), '--encrypt', password.decode(), str(saved)], capture_output=True, timeout=30)
    check = subprocess.run([str(encryptor), '--decrypt', str(saved)], capture_output=True, timeout=30)
    if check.stdout.strip() != b'PASSWORD:' + password:
        raise SystemExit('The SDK could not store the signing password for this Windows user.')
    copy = XML.parse(profile)
    for item in copy.getroot().iter('profileitem'):
        if item.get('key'):
            item.set('password', str(saved))
    copy.write(folder / 'profiles.xml', encoding='UTF-8', xml_declaration=True)
    return folder / 'profiles.xml'


unsigned = dist / 'CleanFrame-unsigned.wgt'
write_widget_archive(unsigned)
signed_dir = dist / 'signed'
signed_dir.mkdir(exist_ok=True)
command = [str(CLI), 'package', '-t', 'wgt', '-s', 'FrameHome', '-o', str(signed_dir), '--', str(unsigned)]
previous = configured_profiles()
with tempfile.TemporaryDirectory() as folder:
    try:
        if WINDOWS:
            use_profiles(saved_password_profile(Path(folder)))
            try:
                result = subprocess.run(command, capture_output=True, stdin=subprocess.DEVNULL, timeout=60)
            except subprocess.TimeoutExpired:
                raise SystemExit('SDK signing timed out.')
            output = result.stdout + result.stderr
        else:
            use_profiles(profile)
            output = answer_prompts(command)
    finally:
        # The temporary profile is deleted, so never leave the SDK pointing at it.
        use_profiles(previous or profile)
redacted = output.replace(password, b'[redacted]').decode(errors='replace')
if 'is created successfully' not in redacted:
    print(redacted)
    # The Windows CLI reports signing errors, such as a wrong password, only in its log.
    data = [line.split('=', 1)[1] for line in (SDK / 'sdk.info').read_text().splitlines() if line.startswith('TIZEN_SDK_DATA_PATH=')]
    raise SystemExit('SDK did not confirm a signed package.' + (' See ' + str(Path(data[0]) / 'cli/logs/cli.log') if data else ''))
signed = signed_dir / unsigned.name
with zipfile.ZipFile(signed) as package:
    if not {'author-signature.xml', 'signature1.xml'}.issubset(package.namelist()):
        raise SystemExit('Package is missing its signing files.')
target = dist / 'CleanFrame.wgt'
target.write_bytes(signed.read_bytes())
print('Signed widget created: ' + str(target))
