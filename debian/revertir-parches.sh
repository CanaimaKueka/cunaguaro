#!/bin/bash

for PARCHE in $( find debian/patches -type f | grep "debian/patches/.*.patch" ); do
	patch -p1 -R < ${PARCHE}
	echo "Desaplicando ${PARCHE}"
done
