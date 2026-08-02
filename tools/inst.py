import subprocess, os
JOBS = [
    ("NR.ttf",  "Newsreader-Regular.ttf",  "wght=400 opsz=16"),
    ("NR.ttf",  "Newsreader-Medium.ttf",   "wght=500 opsz=16"),
    ("NR.ttf",  "Newsreader-SemiBold.ttf", "wght=600 opsz=16"),
    ("NR.ttf",  "Newsreader-Display.ttf",  "wght=400 opsz=52"),
    ("NRI.ttf", "Newsreader-Italic.ttf",   "wght=400 opsz=16"),
    ("MM.ttf",  "MartianMono-Regular.ttf", "wght=400 wdth=100"),
    ("MM.ttf",  "MartianMono-Medium.ttf",  "wght=500 wdth=100"),
]
UNI = "U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-2015,U+2018-201F,U+2026,U+2030,U+00AB,U+00BB,U+20AC,U+2122,U+00D7,U+2212,U+2190-2193,U+25A0-25A1,U+25AA,U+2713"
for src, out, loc in JOBS:
    tmp = "tmp_" + out
    subprocess.run(["python3","-m","fontTools.varLib.instancer", src, *loc.split(), "-o", tmp],
                   check=True, capture_output=True)
    subprocess.run(["python3","-m","fontTools.subset", tmp,
                    f"--unicodes={UNI}", "--layout-features=kern,liga,calt,onum,tnum,frac",
                    "--name-IDs=*", "--notdef-outline", f"--output-file=../assets/fonts/{out}"],
                   check=True, capture_output=True)
    os.remove(tmp)
    print(f"{out:28} {os.path.getsize('../assets/fonts/'+out)//1024:4d} KB")
