set -u
printf 'CLEANFRAME_HOME_INSPECT_BEGIN\n'
ids=$(for p in nClrkHome1 9Ur5IzDKqV org.tizen.browser org.tizen.netflix-app org.tizen.primevideo org.tizen.graphiczoom; do cat /opt/share/packages/$p.xml /usr/share/packages/$p.xml 2>/dev/null | grep -o -m1 'appid="[^"]*"' | head -n1 | cut -d'"' -f2; done)
/usr/bin/dotnet /home/owner/share/tmp/sdk_tools/CleanFrameHomeControl.dll eligible $ids
printf '\nAPP_CONTEXT_LOG\n'
dlogutil -d 2>&1 | grep -i -E 'appboot|app-booting|metadata|webappid|root app|pkg type|package type' | tail -n 80
printf 'CLEANFRAME_HOME_INSPECT_END\n'
