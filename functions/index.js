/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const gcs = require('@google-cloud/storage')({keyFilename:
'adotapet-476b5-firebase-adminsdk-p67hf-60281ac514.json'});
const spawn = require('child-process-promise').spawn;
admin.initializeApp(functions.config().firebase);


exports.generateThumbnail = functions.storage.object()
    .onChange(event => {
        const object = event.data
        const filePath = object.name
        const fileName = filePath.split('/').pop()
        const fileBucket = object.bucket
        const bucket = gcs.bucket(fileBucket)
        const tempFilePath = `/tmp/${fileName}`
        const ref = admin.database().ref()
        const file = bucket.file(filePath)
        const thumbFilePath = filePath.replace(/(\/)?([^\/]*)$/,'$1thumb_$2')

        if (fileName.startsWith('thumb_')) {
            console.log('Já é uma thumbnail')
            return
        }

        if (!object.contentType.startsWith('image/')) {
            console.log('Isto não é uma imagem')
            return
        }

        if (object.resourceState === 'not_exists') {
            console.log('Este é um evento de deletar')
            return
        }

        return bucket.file(filePath).download({
          destination: tempFilePath
        }).then(() => {
          return spawn('convert', [tempFilePath, '-thumbnail', '200X200>', tempFilePath])
          })
          .then(() => {
                console.log('Thumbnail criada.')

                return bucket.upload(tempFilePath, {
                  destination: thumbFilePath
                })
          }).then(() => {
                const thumbFile = bucket.file(thumbFilePath)
                const config = {
                  action: 'read',
                  expires: '03-09-2025'
                 }
                 return Promise.all([
                   thumbFile.getSignedUrl(config),
                   file.getSignedUrl(config)
                 ])
          }).then(results =>  {
            const thumbResult    = results[0]
            const originalResult = results[1]
            const thumbFileUrl   = thumbResult[0]
            const fileUrl        = originalResult[0]

            var key = filePath.substr(14,20)
            console.log(key)
            return ref.child('adocao/pets/' + key).update({thumbnail: thumbFileUrl})
          })
    })

// TODO: Make sure you configure the 'dev_motivator.device_token' Google Cloud environment variables.
const deviceToken = functions.config().dev_motivator.device_token;

// Deletes the user data in the Realtime Datastore when the accounts are deleted.
exports.cleanupUserData = functions.auth.user().onDelete(event => {
        const uid = event.data.uid
return admin.database().ref(`/usuarios/${uid}`).remove()
})
