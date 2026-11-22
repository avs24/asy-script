// Minimal check for the same Asymptote formula label used in the user's example.
// Save as mobius-formula-poc.asy and compile locally with: asy -f svg mobius-formula-poc.asy

import geometry;

unitsize(2cm);

pair A = (0,0), B = (4,3), C = (4,0);

draw(A--B--C--cycle, blue+1bp);
markrightangle(B,C,A,red,PenMargins);
markangle("$60^\circ$",C,A,B,radius=20,n=1,red,PenMargins);
dot(A^^B^^C, UnFill);

label("\( \sqrt{2} \)", (A+B)/2, NW);
dot("A", A, SW, UnFill);
dot("B", B, NE, UnFill);
dot("C", C, SE, UnFill);
label("$a$", (A+C)/2, S);
label("$b$", (B+C)/2, E);
