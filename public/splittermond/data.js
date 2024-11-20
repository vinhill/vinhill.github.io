const sm_fight_skills = "Handgemenge,Hiebwaffen,Kettenwaffen,Klingenwaffen,Stangenwaffen,Schusswaffen,Wurfwaffen".split(",");

const sm_skills = (() => {
    const skills = "Akrobatik,Alchemie,Anführen,Arkane Kunde,Athletik,Darbietung,Diplomatie,Edelhandwerk,Empathie,Entschlossenheit,Fingerfertigkeit,Geschichte & Mythen,Handwerk,Heilkunde,Heimlichkeit,Jagdkunst,Länderkunde,Naturkunde,Redegewandheit,Schlösser & Fallen,Schwimmen,Seefahrt,Straßenkunde,Tierführung,Überleben,Wahrnehmung,Zähigkeit".split(",");
    const names = "Akrobatik,Alchemie,Anfuehren,ArkaneKunde,Athletik,Darbietung,Diplomatie,Edelhandwerk,Empathie,Entschlossenheit,Fingerfertigkeit,GeschichteMythen,Handwerk,Heilkunde,Heimlichkeit,Jagdkunst,Laenderkunde,Naturkunde,Redegewandheit,SchloesserFallen,Schwimmen,Seefahrt,Strassenkunde,Tierfuehrung,Ueberleben,Wahrnehmung,Zaehigkeit".split(",");
    const att1 = "BEW,MYS,AUS,MYS,BEW,AUS,AUS,INT,INT,AUS,AUS,MYS,KON,INT,BEW,KON,INT,INT,AUS,INT,STÄ,BEW,AUS,AUS,INT,INT,KON".split(",");
    const att2 = "STÄ,VER,WIL,VER,STÄ,WIL,VER,VER,VER,WIL,BEW,VER,VER,VER,INT,VER,VER,VER,WIL,BEW,KON,KON,INT,BEW,KON,WIL,WIL".split(",");
    return skills.map((n, i) => ({ skill: n, name: names[i], att1: att1[i], att2: att2[i] }));
})();

const sm_derived_attrs = (() => {
    const names = "Größenklasse,Geschwindigkeit,Initiative,Lebenspunkte,Fokus,Verteidigung,Geistiger Widerstand,Körperl. Widerstand".split(",");
    const abbrev = "GK,GSW,INI,LP,FO,VTD,GW,KW".split(",");
    const formulas = "Rasse,GK+BEW,10-INT,GK+KON,2x(MYS+WIL),12+BEW+STÄ±Rasse,12+VER+WIL,12+KON+WIL".split(",");
    return names.map((n, i) => ({ name: n, abbrev: abbrev[i], formula: formulas[i] }));
})();

const sm_attrs = (() => {
    const attrs = "Ausstrahlung,Beweglichkeit,Intuition,Konstitution,Mystik,Stärke,Verstand,Willenskraft".split(",");
    return attrs.map((n, i) => ({ name: n, abbrev: n.substring(0, 3).toUpperCase() }));
})();

const sm_resources = "Ansehen,Kontakte,Stand,Vermögen,Gefolge,Kreatur,Mentor,Rang,Relikt,Zuflucht".split(",");

const sm_char_attrs = (() => {
    const attrs = "Name,Rasse,Kultur,Abstammung,Ausbildung,Variante,Harr-/Fellfarbe,Augenfarbe,Hautfarbe,Geschlecht,Körpergröße,Gewicht,Geburtsort,Aussehen".split(",");
    const name = "Name,Rasse,Kultur,Abstammung,Ausbildung,Variante,Haarfarbe,Augenfarbe,Hautfarbe,Geschlecht,Koerpergroesse,Gewicht,Geburtsort,Aussehen".split(",");
    return attrs.map((n, i) => ({ attr: n, name: name[i] }));
})();

const sm_magicschools = (() => {
    const schools = "Bann,Beherrschung,Bewegung,Erkenntnis,Fels,Feuer,Heilung,Illusion,Kampf,Licht,Natur,Schatten,Schicksal,Schutz,Stärkung,Tod,Verwandlung,Wasser,Wind".split(",");
    const names = "Bann,Beherrschung,Bewegung,Erkenntnis,Fels,Feuer,Heilung,Illusion,Kampf,Licht,Natur,Schatten,Schicksal,Schutz,Staerkung,Tod,Verwandlung,Wasser,Wind".split(",");
    const att1 = "MYS"
    const att2 = "WIL,WIL,BEW,VER,KON,AUS,AUS,AUS,STÄ,AUS,AUS,INT,AUS,AUS,STÄ,VER,KON,INT,VER".split(",");
    return schools.map((n, i) => ({ school: n, name: names[i], att1: att1, att2: att2[i] }));
})();

const default_tbl_len = 3;
