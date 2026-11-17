#!/bin/bash
# usage: snap.sh page "expr1;;expr2;;..." name  -> contact sheet $S/name.jpg
S=/tmp/claude-0/-home-user-japan-planner/da9d36d7-02e4-5e0e-9bc8-3bedfbed553b/scratchpad
export NODE_MODULES=$S/node_modules
cd /home/user/japan-planner/pregnancy-animation
IFS=';;' read -ra _ <<< ""
n=$(echo "$2" | awk -F';;' '{print NF}')
outs=""; ins=""; for i in $(seq 1 $n); do outs="$outs,$S/_s$i.jpg"; ins="$ins -i $S/_s$i.jpg"; done
node shoot.mjs "$1" "$2" "${outs:1}" 2>&1 | grep -v "GL Driver\|ms$"
cols=${COLS:-3}; rows=$(( (n+cols-1)/cols ))
ffmpeg -y -loglevel error $ins -filter_complex "xstack=inputs=$n:layout=$(python3 -c "
n=$n;c=$cols
print('|'.join(f'{\"+\".join([\"w0\"]*(i%c)) or 0}_{\"+\".join([\"h0\"]*(i//c)) or 0}' for i in range(n)))"):fill=black,scale=1920:-1" $S/$3.jpg 2>&1 | tail -2
echo $S/$3.jpg
