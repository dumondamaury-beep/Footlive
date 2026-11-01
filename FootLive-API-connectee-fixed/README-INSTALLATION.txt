FOOTLIVE – MISE À JOUR API-FOOTBALL (NETLIFY)

Ton compte API-Football affiche déjà FOOTBALL / Free / Active / 100 requêtes par jour. Tu n’as rien à acheter.

ÉTAPE 1 – AJOUTER LA CLÉ API DANS NETLIFY
1. Dans API-Football > My Access, copie la clé API-KEY (ne la partage avec personne).
2. Ouvre https://app.netlify.com/ et connecte-toi au compte qui héberge FootLive.
3. Ouvre le site FootLive correspondant à https://dulcet-kelpie-95ca00.netlify.app.
4. Va dans Site configuration (ou Project configuration) > Environment variables.
5. Ajoute une variable :
   Nom : API_FOOTBALL_KEY
   Valeur : colle ici ta clé API-FOOTBALL
   Scope : Functions (ou All scopes).
6. Enregistre.

ÉTAPE 2 – PUBLIER LA NOUVELLE VERSION AVEC LA FONCTION
IMPORTANT : le simple glisser-déposer d’un dossier de fichiers statiques ne suffit pas à garantir la publication de la fonction serveur. Netlify indique que les fonctions doivent être déployées via Git, Netlify CLI ou son API.

Méthode recommandée sans ligne de commande :
1. Décompresse FootLive-API-connectee.zip sur ton ordinateur.
2. Crée un dépôt GitHub privé et ajoute-y TOUS les fichiers du dossier FootLive-API-connectee (index.html, manifest, netlify.toml et dossier netlify/functions).
3. Dans Netlify, ouvre le site FootLive et relie-le à ce dépôt via Project configuration > Build & deploy > Continuous deployment.
4. Vérifie que le dossier de publication est la racine du dépôt et que le dossier des fonctions est netlify/functions (déjà indiqué dans netlify.toml).
5. Lance le déploiement. Netlify publiera alors les fichiers du site ET la fonction football.

Autre méthode : utiliser Netlify CLI depuis un ordinateur avec `netlify link` puis `netlify deploy --prod` à la racine du dossier décompressé.

ÉTAPE 3 – TESTER
Ouvre dans un navigateur : https://dulcet-kelpie-95ca00.netlify.app/.netlify/functions/football?type=live
Si la clé est correctement configurée, tu dois obtenir une réponse JSON avec response et _quota. Si tu vois missing_api_key, la variable Netlify manque ou le site n’a pas été redéployé.

FONCTIONNEMENT / QUOTA
- La fonction Netlify conserve la clé secrète côté serveur ; elle n’est pas dans le code public.
- Les scores des trois compétitions sont actualisés au maximum toutes les 30 minutes quand FootLive est ouvert et visible.
- Classements, buteurs, résultats et calendrier sont mis en cache 24 heures dans le navigateur et sur le réseau Netlify.
- Le premier chargement sans cache utilise jusqu’à 13 appels API (1 scores live + 4 catégories x 3 compétitions). Le cache évite de refaire ces appels à chaque ouverture.
- Les données 2026-2027 dépendent de la disponibilité réelle de chaque compétition dans l’API. Aucune fausse donnée de démonstration n’est affichée si l’API ne renvoie rien.
- Les notifications push lorsque l’application est fermée ne sont pas incluses.

AIDE
Si le test JSON renvoie une erreur, envoie une capture du résultat en masquant impérativement la clé API.


CORRECTION IMPORTANTE
La fonction serveur lit exactement la variable API_FOOTBALL_KEY. Le nom doit correspondre caractère par caractère à celui créé dans Netlify.
