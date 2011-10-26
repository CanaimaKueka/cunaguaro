#!/bin/bash

for PARCHES in $( find patches -type f | grep ".patch" ); do
	patch -R ${PARCHES}
	echo "Desaplicando ${PARCHES}"
done
