set -u
printf 'CLEANFRAME_HOME_INSPECT_BEGIN\n'
printf 'INSTALL_LOCATIONS\n'
for p in /opt/usr/apps /opt/usr/globalapps /opt/usr/home/owner/apps_rw /usr/apps; do ls -ld "$p/nClrkHome1" 2>/dev/null; done
printf '\nINSTALLED_WIDGET_MANIFEST\n'
for p in /opt/usr/apps /opt/usr/globalapps /opt/usr/home/owner/apps_rw /usr/apps; do f="$p/nClrkHome1/res/wgt/config.xml"; [ -r "$f" ] && { echo "$f"; head -c 4000 "$f"; echo; }; done
printf '\nPACKAGE_MANAGER_MANIFEST\n'
for f in /opt/share/packages/nClrkHome1.xml /usr/share/packages/nClrkHome1.xml; do [ -r "$f" ] && { echo "$f"; head -c 6000 "$f"; echo; }; done
printf '\nELIGIBILITY_LIBRARY_STRINGS\n'
grep -a -o '[[:print:]]\{5,\}' /usr/lib/libapp-context-manager-common.so 2>/dev/null | grep -i -E 'boot|webapp|metadata|category|privilege|allow|white|support|\.(json|xml|ini|conf|db)' | head -n 300
printf '\nAPP_BOOTING_METADATA_SURVEY\n'
grep -o -E '<metadata[^>]*(appbooting|livetv)[^>]*>' /usr/share/packages/*.xml /opt/share/packages/*.xml 2>/dev/null | head -n 80
printf 'CLEANFRAME_HOME_INSPECT_END\n'
