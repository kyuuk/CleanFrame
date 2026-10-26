set -u
printf 'CLEANFRAME_HOME_INSPECT_BEGIN\n'
# The helper cannot read package manifests on the Tizen 8 TV, so the shell confirms the launcher's boot metadata.
flag=
grep -q '<metadata key="http://samsung.com/tv/metadata/appbootingsupport"' /opt/share/packages/nClrkHome1.xml 2>/dev/null && flag=boot-metadata
/usr/bin/dotnet /home/owner/share/tmp/sdk_tools/CleanFrameHomeControl.dll apply /home/owner/share/tmp/sdk_tools/CleanFrameHomeOriginal.json $flag || printf 'CLEANFRAME_HOME_EXIT=%s\n' "$?"
printf 'CLEANFRAME_HOME_INSPECT_END\n'
