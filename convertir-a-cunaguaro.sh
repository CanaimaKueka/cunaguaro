#!/bin/bash

ACTUAL=$( pwd )

LLAVE="Iceweasel_____________________Cunaguaro"

OPCIONES="${LLAVE} $( echo ${LLAVE} | tr '[:lower:]' '[:upper:]' ) $( echo ${LLAVE} | tr '[:upper:]' '[:lower:]' )"

for REEMPLAZAR in ${OPCIONES}; do

	ICEWEASEL=${REEMPLAZAR%_____________________*}
	CUNAGUARO=${REEMPLAZAR#${ICEWEASEL}_____________________}

	for ARCHIVO in $( find ${CURRENT} -type f ); do

		mv ${ARCHIVO} $( echo ${ARCHIVO} | sed "s/${ICEWEASEL}/${CUNAGUARO}/g" )

		sed -i "s/${ICEWEASEL}/${CUNAGUARO}/g" ${ARCHIVO}

	done

done



