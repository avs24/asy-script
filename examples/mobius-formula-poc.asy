// Minimal check for the same Asymptote formula label used in the user's example.
// Save as mobius-formula-poc.asy and compile locally with: asy -f svg mobius-formula-poc.asy

import geometry;

unitsize(1cm);

pair A = (0,0), B = (4,3), C = (4,0);

draw(A--B--C--cycle, blue+1bp);
markrightangle(B,C,A,red,PenMargins);
markangle("$60^\circ$",C,A,B,radius=20,n=1,red,PenMargins);
dot(A^^B^^C, UnFill);

label("\( \sqrt{2} \)", (A+B)/2, NW);
label("A", A, SW);
label("B", B, NE);
label("C", C, SE);
