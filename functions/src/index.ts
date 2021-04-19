import * as functions from "firebase-functions";
import * as firebase from "firebase-admin";
import { parseAsync } from 'json2csv';
import { v4 as uuidv4 } from 'uuid';
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

firebase.initializeApp({
  storageBucket: 'bucket-name', // cloud storage bucket
});

export const generateApplicationCsv = functions.region('us-east4').pubsub
  .topic("generate-application-csv")
  .onPublish(async message => {

    // gets the documents from the firestore collection
    const Snapshot = await firebase
      .firestore()
      .collection("collection-name")
      .get();

    const collections = Snapshot.docs.map(doc => doc.data());

    // csv field headers
    const fields = [
      'title',
      'description',
    ];

    // get csv output
    const output = await parseAsync(collections, { fields });

    // generate filename
    const dateTime = new Date().toISOString().replace(/\W/g, "");
    const filename = `collections_${dateTime}.csv`;

    const tempLocalFile = path.join(os.tmpdir(), filename);

    return new Promise((resolve, reject) => {
      //write contents of csv into the temp file
      fs.writeFile(tempLocalFile, output, error => {
        if (error) {
          reject(error);
          return;
        }
        const bucket = firebase.storage().bucket();

        // upload the file into the current firebase project default bucket
        bucket
           .upload(tempLocalFile, {
            // Workaround: firebase console not generating token for files
            // uploaded via Firebase Admin SDK
            // https://github.com/firebase/firebase-admin-node/issues/694
            metadata: {
              metadata: {
                firebaseStorageDownloadTokens: uuidv4(),
              }
            },
          })
          .then(() => resolve())
          .catch(errorr => reject(errorr));
      });
    });
  });