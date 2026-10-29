# MiniLM toxicity model

Bundled model: `minuva/MiniLMv2-toxic-jigsaw-onnx`

- Source: https://huggingface.co/minuva/MiniLMv2-toxic-jigsaw-onnx
- Base model: `nreimers/MiniLMv2-L6-H384-distilled-from-BERT-Large`
- Training data: Jigsaw Toxic Comment Classification Challenge
- License: Apache-2.0
- Model card: https://huggingface.co/minuva/MiniLMv2-toxic-jigsaw-onnx

## Local modification

The upstream ONNX file declares unused opset imports (including
`com.ms.internal.nhwc` opset 19) that older ONNX Runtime builds reject. The
bundled `onnx/model_quantized.onnx` is the upstream int8 model with only those
unused imports removed. Model weights and graph nodes are unchanged.

The tokenizer and config files are copied from the upstream repository.
