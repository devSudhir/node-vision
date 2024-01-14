require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
} = require("@aws-sdk/client-s3");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const bucketName =
  process.env.AWS_BUCKET_NAME || `sudhir-image-rekognition-${uuidv4()}`;

const router = express.Router();

router.post("/classify", async function (req, res, next) {
  try {
    console.log("Hey classify image hit");

    const file = req.files.file;

    const s3Client = new S3Client({
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      region: process.env.AWS_REGION,
    });

    // Create an Amazon S3 bucket
    try {
      await s3Client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
        })
      );
      console.log(`Bucket "${bucketName}" created successfully.`);
    } catch (error) {
      console.error("Error creating bucket:", error.message);
      return res.status(500).json({ error: "Unable to create bucket" });
    }

    // Upload the file to the bucket
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: file.name,
          Body: file.data,
        })
      );
      console.log(`${file.name} uploaded successfully.`);
    } catch (error) {
      console.error("Error uploading to bucket:", error.message);
      return res.status(500).json({ error: "Unable to upload file to bucket" });
    }

    const rekognitionClient = new AWS.Rekognition();
    const params = {
      Image: {
        S3Object: {
          Bucket: bucketName,
          Name: file.name,
        },
      },
      MaxLabels: 30,
    };

    // Detect labels using Amazon Rekognition
    rekognitionClient.detectLabels(params, function (err, response) {
      if (err) {
        console.log(err, err.stack);
        return res.status(500).json({ error: "Unable to process the request" });
      } else {
        console.log(`Detected labels for: ${file.name}`);
        const keywords = response.Labels.map((label) => label.Name);
        res.status(200).json({ labels: keywords });
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error.message);
    res.status(500).json({ error: "Unexpected error occurred" });
  }
});

module.exports = router;
